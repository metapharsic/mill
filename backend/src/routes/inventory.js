const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireLevel, requireStore } = require('../middleware/auth');
const { publish, TOPICS } = require('../kafka');

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Shift derivation: Day 06:00-18:00, else Night. Explicit req.body.shift wins if given.
const deriveShift = (explicit) => {
  if (explicit === 'Day' || explicit === 'Night') return explicit;
  const hr = new Date().getHours();
  return (hr >= 6 && hr < 18) ? 'Day' : 'Night';
};

// High-txn thresholds: value > 1,00,000 OR qty moved > 50% of current stock in one go.
const HIGH_VALUE = 100000;
const HIGH_PCT = 0.5;

// Notify store dept heads (level>=3) + plant admin (level>=4) on a high inward/outward txn.
async function notifyHighTxn(client, { direction, materialId, materialName, qty, value, shift, userId }) {
  const { rows: recipients } = await client.query(`
    SELECT u.id FROM users u
      JOIN departments d ON u.department_id = d.id
      JOIN roles r ON u.role_id = r.id
    WHERE d.code = 'STORE' AND r.level >= 3 AND u.is_active = true
    UNION
    SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
    WHERE r.level >= 4 AND u.is_active = true
  `);
  const title = `High ${direction}: ${materialName}`;
  const message = `${direction} of ${qty} (₹${value.toFixed(0)}) logged during ${shift} shift.`;
  for (const r of recipients) {
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, ref_table, ref_id) VALUES ($1,'critical',$2,$3,'stock_ledger',$4)`,
      [r.id, title, message, materialId]
    );
  }
  publish(TOPICS.EVENTS_CRIT, `stock-${materialId}`, { event: `stock.${direction.toLowerCase()}.high`, materialId, qty, value, shift, userId, timestamp: new Date() });
}

const buildSequenceNumber = async (client, prefix) => {
  const today = new Date();
  const stamp = today.toISOString().slice(0, 10).replace(/-/g, '');
  const { rows } = await client.query(
    `SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq
     FROM grn
     WHERE grn_number LIKE $1`,
    [`${prefix}-${stamp}-%`]
  );
  return `${prefix}-${stamp}-${rows[0].seq}`;
};

function getStoreTypeFilter(storeType, prefix = 'mc') {
  if (!storeType || storeType === 'all_store' || storeType === 'store') {
    return `(${prefix}.type IN ('Mechanical', 'Electrical', 'Consumable', 'Spare Part') OR ${prefix}.id IN (29,30,31,32,33,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60))`;
  }
  if (storeType === 'mechanical') {
    return `(${prefix}.type = 'Mechanical' OR ${prefix}.name ILIKE '%Mech%' OR ${prefix}.code LIKE 'MECH%' OR ${prefix}.id IN (31,36,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55))`;
  }
  if (storeType === 'electrical') {
    return `(${prefix}.type = 'Electrical' OR ${prefix}.name ILIKE '%Elec%' OR ${prefix}.code LIKE 'ELEC%' OR ${prefix}.id IN (30,56,57,58,59,60))`;
  }
  if (storeType === 'consumable') {
    return `(${prefix}.type = 'Consumable' OR ${prefix}.id IN (29,33,34,35))`;
  }
  if (storeType === 'chemical') {
    return `(${prefix}.type = 'Raw Material' OR ${prefix}.id = 28 OR ${prefix}.name ILIKE '%Chem%')`;
  }
  if (storeType === 'all') {
    return '1=1';
  }
  return '1=1';
}

router.get('/categories', auth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, code, type
     FROM material_categories
     ORDER BY name`
  );
  res.json({ success: true, data: rows });
}));

router.get('/materials', auth, asyncRoute(async (req, res) => {
  const { categoryId, store_type, search, low_stock, page = 1, limit = 50 } = req.query;
  const conditions = ['m.is_active = true'];
  const params = [];
  let p = 1;

  if (store_type && store_type !== 'all') {
    conditions.push(getStoreTypeFilter(store_type, 'mc'));
  } else if (!store_type) {
    // Default to store inventory for store management
    conditions.push(getStoreTypeFilter('store', 'mc'));
  }

  if (categoryId) {
    conditions.push(`m.category_id = $${p++}`);
    params.push(categoryId);
  }

  if (low_stock === 'true') {
    conditions.push(`m.current_stock <= m.reorder_level`);
  }

  if (search) {
    conditions.push(`(m.name ILIKE $${p} OR m.code ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { rows } = await pool.query(
    `SELECT m.id,
            m.code,
            m.name,
            m.category_id as "categoryId",
            m.uom,
            m.reorder_level as "reorderLevel",
            m.min_stock as "minStock",
            m.max_stock as "maxStock",
            m.current_stock as "currentStock",
            m.current_stock as "current_stock",
            m.unit_price as "unitPrice",
            m.unit_price as "unit_price",
            m.is_active as "isActive",
            mc.name as "categoryName",
            mc.type as "categoryType",
            COALESCE((SELECT COUNT(DISTINCT pi.po_id) FROM po_items pi WHERE pi.material_id = m.id), 0)::int AS "poCount",
            COALESCE((SELECT COUNT(DISTINCT pi.po_id) FROM po_items pi WHERE pi.material_id = m.id), 0)::int AS po_count
     FROM materials m
     LEFT JOIN material_categories mc ON mc.id = m.category_id
     ${where}
     ORDER BY m.code, m.name
     LIMIT $${p++} OFFSET $${p++}`,
    [...params, limit, offset]
  );

  const count = await pool.query(`
    SELECT COUNT(*) AS total FROM materials m
    LEFT JOIN material_categories mc ON mc.id = m.category_id
    ${where}
  `, params);
  res.json({ success: true, data: rows, total: parseInt(count.rows[0].total) });
}));

router.get('/summary', auth, asyncRoute(async (req, res) => {
  const { store_type } = req.query;
  const filter = getStoreTypeFilter(store_type, 'mc');
  
  const totalMaterials = await pool.query(`
    SELECT COUNT(*) AS total FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE m.is_active = true AND ${filter}
  `);
  const lowStock = await pool.query(`
    SELECT COUNT(*) AS total FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE m.is_active = true AND m.current_stock <= m.reorder_level AND ${filter}
  `);
  const pendingGRN = await pool.query(`SELECT COUNT(*) AS total FROM grn WHERE status IN ('Draft', 'Received', 'QC Pending')`);
  const stockValue = await pool.query(`
    SELECT COALESCE(SUM(m.current_stock * m.unit_price), 0) AS total FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE m.is_active = true AND ${filter}
  `);

  res.json({
    success: true,
    data: {
      totalMaterials: parseInt(totalMaterials.rows[0].total),
      lowStock: parseInt(lowStock.rows[0].total),
      pendingGrn: parseInt(pendingGRN.rows[0].total),
      stockValue: Number(stockValue.rows[0].total),
    },
  });
}));

// Admin view: inward/outward by shift + who logged it + high-txn flags.
router.get('/ledger/shift-summary', auth, requireLevel(3), asyncRoute(async (req, res) => {
  const { date, shift, store_type } = req.query;
  const conds = []; const params = []; let i = 1;
  if (date)  { conds.push(`sl.date = $${i++}`); params.push(date); }
  if (shift) { conds.push(`sl.shift = $${i++}`); params.push(shift); }
  if (store_type && store_type !== 'all') {
    conds.push(getStoreTypeFilter(store_type, 'mc'));
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows: totals } = await pool.query(`
    SELECT sl.shift,
           COALESCE(SUM(sl.in_qty),0) as "totalIn",
           COALESCE(SUM(sl.out_qty),0) as "totalOut",
           COALESCE(SUM(sl.value) FILTER (WHERE sl.in_qty > 0),0) as "inValue",
           COALESCE(SUM(sl.value) FILTER (WHERE sl.out_qty > 0),0) as "outValue",
           COUNT(*) FILTER (WHERE sl.is_high_txn) as "highTxnCount"
    FROM stock_ledger sl
    LEFT JOIN materials m ON m.id = sl.material_id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    ${where}
    GROUP BY sl.shift ORDER BY sl.shift`, params);

  const { rows: entries } = await pool.query(`
    SELECT sl.id, sl.date, sl.shift, sl.transaction_type as "type", m.name as "materialName",
           sl.in_qty as "inQty", sl.out_qty as "outQty", sl.value, sl.is_high_txn as "isHigh",
           u.name as "loggedBy", sl.created_at as "loggedAt"
    FROM stock_ledger sl
    LEFT JOIN materials m ON m.id = sl.material_id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN users u ON u.id = sl.created_by
    ${where} ORDER BY sl.created_at DESC LIMIT 200`, params);

  res.json({ success: true, data: { totals, entries } });
}));

router.get('/ledger', auth, asyncRoute(async (req, res) => {
  const { page = 1, limit = 20, store_type, search, transaction_type, from, to } = req.query;
  const conditions = [];
  const params = [];
  let p = 1;

  if (store_type && store_type !== 'all') {
    conditions.push(getStoreTypeFilter(store_type, 'mc'));
  } else if (!store_type) {
    conditions.push(getStoreTypeFilter('store', 'mc'));
  }

  if (search) {
    conditions.push(`(m.name ILIKE $${p} OR m.code ILIKE $${p} OR sl.batch_number ILIKE $${p} OR sl.remarks ILIKE $${p})`);
    params.push(`%${search}%`);
    p++;
  }

  if (transaction_type) {
    conditions.push(`sl.transaction_type ILIKE $${p++}`);
    params.push(`%${transaction_type}%`);
  }

  if (from) {
    conditions.push(`sl.date >= $${p++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`sl.date <= $${p++}`);
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  const { rows } = await pool.query(
    `SELECT sl.id,
            sl.material_id as "materialId",
            m.name as "materialName",
            m.code as "materialCode",
            mc.name as "categoryName",
            sl.date,
            sl.transaction_type as "transactionType",
            sl.reference_type as "referenceType",
            sl.in_qty as "inQty",
            sl.out_qty as "outQty",
            sl.balance,
            sl.unit_price as "unitPrice",
            sl.value,
            sl.batch_number as "batchNumber",
            sl.bin_location as "binLocation",
            sl.remarks,
            u.name as "createdByName"
     FROM stock_ledger sl
     LEFT JOIN materials m ON m.id = sl.material_id
     LEFT JOIN material_categories mc ON m.category_id = mc.id
     LEFT JOIN users u ON u.id = sl.created_by
     ${where}
     ORDER BY sl.date DESC, sl.created_at DESC
     LIMIT $${p++} OFFSET $${p++}`,
    [...params, parseInt(limit), offset]
  );
  
  const countRes = await pool.query(`
    SELECT COUNT(*) AS total FROM stock_ledger sl
    LEFT JOIN materials m ON m.id = sl.material_id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    ${where}
  `, params);
  res.json({ success: true, data: rows, total: parseInt(countRes.rows[0].total) });
}));

router.post('/grn', auth, requireLevel(2), asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      date,
      vendorId,
      poId,
      gatePassId,
      vehicleNumber,
      challanNumber,
      invoiceNumber,
      remarks,
      items,
      shift: shiftIn,
    } = req.body;

    if (!date || !vendorId || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'date, vendorId, and items required' });
    }
    for (const [idx, item] of items.entries()) {
      if (!item.materialId) continue;
      const rq = Number(item.receivedQty || 0);
      const aq = Number(item.acceptedQty ?? item.receivedQty ?? 0);
      if (rq <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: `Item ${idx+1}: received quantity must be greater than 0` }); }
      if (aq < 0) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: `Item ${idx+1}: accepted quantity cannot be negative` }); }
      if (aq > rq) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: `Item ${idx+1}: accepted quantity (${aq}) cannot exceed received quantity (${rq})` }); }
    }
    if (poId) {
      const { rows: [poRow] } = await client.query(`SELECT status FROM purchase_orders WHERE id=$1`, [poId]);
      if (!poRow) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Referenced PO does not exist' });
      }
      if (!['Approved', 'Partial'].includes(poRow.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Cannot receive GRN against a PO in '${poRow.status}' status — PO must be Approved or Partial` });
      }
    }

    const shift = deriveShift(shiftIn);
    const highTxns = [];

    const grnNumber = await buildSequenceNumber(client, 'GRN');
    const grnResult = await client.query(
      `INSERT INTO grn (grn_number, date, vendor_id, po_id, gate_pass_id, vehicle_number, challan_number, invoice_number, received_by, status, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, grn_number as "grnNumber"`,
      [grnNumber, date, vendorId, poId || null, gatePassId || null, vehicleNumber || null, challanNumber || null, invoiceNumber || null, req.user.id, 'Received', remarks || null]
    );

    const grnId = grnResult.rows[0].id;

    if (gatePassId) {
      await client.query(`UPDATE gate_passes SET status = 'Closed' WHERE id = $1`, [gatePassId]);
    }

    for (const item of items) {
      if (!item.materialId || !item.receivedQty) continue;
      const acceptedQty = Number(item.acceptedQty ?? item.receivedQty);
      const rejectedQty = Number(item.receivedQty) - acceptedQty;
      const unitPrice = Number(item.unitPrice || 0);

      await client.query(
        `INSERT INTO grn_items (grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price, batch_number, mfg_date, expiry_date, bin_location, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          grnId,
          item.materialId,
          item.poQty || 0,
          item.receivedQty,
          acceptedQty,
          rejectedQty,
          item.uom || null,
          unitPrice,
          item.batchNumber || null,
          item.mfgDate || null,
          item.expiryDate || null,
          item.binLocation || null,
          item.remarks || null,
        ]
      );

      // If rejected quantity exists, generate a material_rejection entry
      if (rejectedQty > 0) {
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`rej-${stamp}`]);
        const seqRes = await client.query(`SELECT COUNT(*)+1 AS n FROM material_rejections WHERE created_at::date = CURRENT_DATE`);
        const rejNum = `REJ-${stamp}-${String(seqRes.rows[0].n).padStart(4, '0')}`;
        const debitAmt = rejectedQty * unitPrice;

        await client.query(
          `INSERT INTO material_rejections
             (rejection_number, grn_id, po_id, vendor_id, material_id, rejected_qty, uom, unit_price, debit_amount, rejection_reason, action_required, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Return to Vendor', 'Pending RTV', $11)`,
          [rejNum, grnId, poId || null, vendorId, item.materialId, rejectedQty, item.uom || 'Nos', unitPrice, debitAmt, item.remarks || 'Rejected during Inward GRN Intake', req.user.id]
        );
      }

      const materialRes = await client.query(
        `SELECT current_stock as "currentStock", unit_price as "unitPrice" FROM materials WHERE id = $1`,
        [item.materialId]
      );
      const currentStock = Number(materialRes.rows[0]?.currentStock || 0);
      const currentUnitPrice = Number(materialRes.rows[0]?.unitPrice || 0);
      const nextStock = currentStock + acceptedQty;
      const nextUnitPrice = unitPrice || currentUnitPrice;

      await client.query(
        `UPDATE materials
         SET current_stock = $1, unit_price = $2
         WHERE id = $3`,
        [nextStock, nextUnitPrice, item.materialId]
      );

      const txnValue = acceptedQty * nextUnitPrice;
      const isHigh = txnValue > HIGH_VALUE || (currentStock > 0 && acceptedQty / currentStock > HIGH_PCT);
      if (isHigh) highTxns.push({ materialId: item.materialId, qty: acceptedQty, value: txnValue });

      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_id, reference_type, in_qty, balance, unit_price, value, batch_number, bin_location, remarks, created_by, shift, is_high_txn)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          item.materialId,
          date,
          'grn',
          grnId,
          'GRN',
          acceptedQty,
          nextStock,
          nextUnitPrice,
          txnValue,
          item.batchNumber || null,
          item.binLocation || null,
          `GRN ${grnNumber}`,
          req.user.id,
          shift,
          isHigh,
        ]
      );

      // Digital Twin & Unique Serialization: Auto-register unique serial numbers for Machine Clothing
      const { rows: [matFull] } = await client.query(
        `SELECT m.id, m.name, m.code, m.is_serialized, m.expected_lifespan_days, mc.name as category_name
         FROM materials m
         LEFT JOIN material_categories mc ON m.category_id = mc.id
         WHERE m.id = $1`,
        [item.materialId]
      );
      const isClothing = matFull?.is_serialized || (matFull?.category_name && matFull.category_name.toLowerCase().includes('clothing'));
      if (isClothing && acceptedQty > 0) {
        let rawSerials = item.serialNumber || item.serialNumbers || item.batchNumber || '';
        let snList = [];
        if (Array.isArray(rawSerials)) {
          snList = rawSerials.map(s => String(s).trim()).filter(Boolean);
        } else if (typeof rawSerials === 'string' && rawSerials.trim()) {
          snList = rawSerials.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        }

        const countToCreate = Math.floor(acceptedQty);
        while (snList.length < countToCreate) {
          const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const rand = Math.floor(1000 + Math.random() * 9000);
          snList.push(`${matFull?.code || 'PMC'}-${stamp}-${rand}`);
        }

        for (let i = 0; i < countToCreate; i++) {
          const sn = snList[i];
          const { rows: dupRows } = await client.query(
            `SELECT id, asset_number, status FROM installed_assets 
             WHERE LOWER(TRIM(serial_number)) = LOWER(TRIM($1)) AND status NOT IN ('retired', 'scrapped')`,
            [sn]
          );
          if (dupRows.length > 0) {
            throw new Error(`Serial number "${sn}" already exists in Mill Asset Registry (Asset #${dupRows[0].asset_number}, Status: ${dupRows[0].status}). All Paper Machine Clothing & Serialized rolls must have unique serial numbers.`);
          }

          const today = new Date();
          const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
          await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`ast-${dateStr}`]);
          const { rows: assetSeq } = await client.query(`SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq FROM installed_assets WHERE asset_number LIKE $1`, [`AST-${dateStr}-%`]);
          const assetNumber = `AST-${dateStr}-${assetSeq[0].seq}`;

          await client.query(
            `INSERT INTO installed_assets (
               asset_number, material_id, serial_number, batch_number, grn_id, vendor_id,
               purchase_price, status, expected_lifespan_days, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'In Stock', $8, NOW())`,
            [
              assetNumber, matFull.id, sn, item.batchNumber || null, grnId, vendorId || null,
              nextUnitPrice, matFull.expected_lifespan_days || 90
            ]
          );
        }
      }
    }

    if (poId) {
      for (const item of items) {
        if (!item.materialId || !item.receivedQty) continue;
        const acceptedQty = Number(item.acceptedQty ?? item.receivedQty);
        await client.query(
          `UPDATE po_items SET received_qty = COALESCE(received_qty,0) + $1 WHERE po_id=$2 AND material_id=$3`,
          [acceptedQty, poId, item.materialId]
        );
      }
      const { rows: poItemRows } = await client.query(
        `SELECT qty, received_qty FROM po_items WHERE po_id=$1`, [poId]
      );
      const fullyReceived = poItemRows.length > 0 && poItemRows.every(r => Number(r.received_qty || 0) >= Number(r.qty));
      await client.query(
        `UPDATE purchase_orders SET status=$1 WHERE id=$2 AND status IN ('Approved','Partial')`,
        [fullyReceived ? 'Received' : 'Partial', poId]
      );
    }

    await client.query('COMMIT');

    // Stage 8: hand off GRN documents to accounts/finance dept for AP processing.
    try {
      const { rows: finUsers } = await pool.query(`
        SELECT u.id FROM users u
          JOIN departments d ON u.department_id = d.id
          JOIN roles r ON u.role_id = r.id
        WHERE d.code = 'FIN' AND r.level >= 2 AND u.is_active = true
        UNION
        SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
        WHERE r.level >= 4 AND u.is_active = true
      `);
      for (const f of finUsers) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, ref_table, ref_id) VALUES ($1,'info',$2,$3,'grn',$4)`,
          [f.id, `GRN ${grnNumber} received`, `GRN ${grnNumber} for vendor received and stock updated. Ready for AP/vendor payables processing.`, grnId]
        );
      }
    } catch (e) { /* notification failure must not block GRN entry */ }

    for (const h of highTxns) {
      const { rows: [mat] } = await pool.query(`SELECT name FROM materials WHERE id=$1`, [h.materialId]);
      await notifyHighTxn(pool, { direction: 'Inward', materialId: h.materialId, materialName: mat?.name || `material #${h.materialId}`, qty: h.qty, value: h.value, shift, userId: req.user.id });
    }
    res.status(201).json({ success: true, data: { grnId, grnNumber } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// GET /api/inventory/grn — list with filters
router.get('/grn', auth, asyncRoute(async (req, res) => {
  const { status, vendor_id, from, to, page = 1, limit = 20 } = req.query;
  const conds = []; const params = []; let p = 1;
  if (status)    { conds.push(`g.status=$${p++}`);         params.push(status); }
  if (vendor_id) { conds.push(`g.vendor_id=$${p++}`);      params.push(vendor_id); }
  if (from)      { conds.push(`g.date>=$${p++}`);          params.push(from); }
  if (to)        { conds.push(`g.date<=$${p++}`);          params.push(to); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { rows } = await pool.query(
    `SELECT g.id, g.grn_number as "grnNumber", g.date, g.status,
            g.vehicle_number as "vehicleNumber", g.challan_number as "challanNumber",
            g.invoice_number as "invoiceNumber", g.remarks,
            v.name as "vendorName", u.name as "receivedByName",
            COUNT(gi.id)::int as "itemCount"
     FROM grn g
     LEFT JOIN vendors v ON v.id=g.vendor_id
     LEFT JOIN users u ON u.id=g.received_by
     LEFT JOIN grn_items gi ON gi.grn_id=g.id
     ${where}
     GROUP BY g.id, v.name, u.name
     ORDER BY g.date DESC, g.created_at DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*) FROM grn g ${where}`, params
  );
  res.json({ success: true, data: rows, total: parseInt(cnt[0].count) });
}));

// PUT /api/inventory/grn/:id — Update GRN header & line items price/quantities
router.put('/grn/:id', auth, requireLevel(2), asyncRoute(async (req, res) => {
  const grnId = req.params.id;
  const isNum = /^\d+$/.test(String(grnId));
  const { vehicle_number, challan_number, invoice_number, remarks, date, items } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [grn] } = await client.query(
      isNum ? 'SELECT * FROM grn WHERE id = $1 FOR UPDATE' : 'SELECT * FROM grn WHERE grn_number = $1 FOR UPDATE',
      [isNum ? parseInt(grnId) : String(grnId)]
    );
    if (!grn) throw new Error('GRN not found');

    await client.query(`
      UPDATE grn
      SET vehicle_number = COALESCE($1, vehicle_number),
          challan_number = COALESCE($2, challan_number),
          invoice_number = COALESCE($3, invoice_number),
          remarks = COALESCE($4, remarks),
          date = COALESCE($5::date, date)
      WHERE id = $6
    `, [vehicle_number || null, challan_number || null, invoice_number || null, remarks || null, date || null, grn.id]);

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const itemCond = it.id ? 'gi.id = $1' : 'gi.grn_id = $1 AND gi.material_id = $2';
        const itemParams = it.id ? [it.id] : [grn.id, it.material_id];
        const { rows: [existItem] } = await client.query(
          `SELECT gi.*, m.current_stock FROM grn_items gi JOIN materials m ON m.id = gi.material_id WHERE ${itemCond} FOR UPDATE`,
          itemParams
        );

        if (existItem) {
          const oldAcc = parseFloat(existItem.accepted_qty || existItem.received_qty || 0);
          const newRec = it.received_qty !== undefined ? parseFloat(it.received_qty) : parseFloat(existItem.received_qty || 0);
          const newAcc = it.accepted_qty !== undefined ? parseFloat(it.accepted_qty) : (it.received_qty !== undefined ? parseFloat(it.received_qty) : oldAcc);
          const newRej = it.rejected_qty !== undefined ? parseFloat(it.rejected_qty) : (newRec - newAcc);
          const newPrice = it.unit_price !== undefined && it.unit_price !== '' ? parseFloat(it.unit_price) : parseFloat(existItem.unit_price || 0);
          const newBin = it.bin_location || existItem.bin_location;
          const newBatch = it.batch_number || existItem.batch_number;
          const newRemarks = it.remarks || existItem.remarks;
          const delta = newAcc - oldAcc;

          await client.query(`
            UPDATE grn_items
            SET received_qty = $1,
                accepted_qty = $2,
                rejected_qty = $3,
                unit_price = $4,
                bin_location = $5,
                batch_number = $6,
                remarks = $7
            WHERE id = $8
          `, [newRec, newAcc, newRej, newPrice, newBin || null, newBatch || null, newRemarks || null, existItem.id]);

          await client.query(`
            UPDATE materials
            SET current_stock = current_stock + $1,
                unit_price = CASE WHEN $2 > 0 THEN $2 ELSE unit_price END,
                bin_location = COALESCE($3, bin_location)
            WHERE id = $4
          `, [delta, newPrice, newBin || null, existItem.material_id]);

          const { rows: [ledgerRow] } = await client.query(`
            SELECT id, in_qty, balance FROM stock_ledger
            WHERE reference_type = 'GRN' AND reference_id = $1 AND material_id = $2
            ORDER BY id DESC LIMIT 1
          `, [grn.id, existItem.material_id]);

          if (ledgerRow) {
            await client.query(`
              UPDATE stock_ledger
              SET in_qty = $1,
                  balance = balance + $2,
                  unit_price = $3,
                  value = $4,
                  bin_location = COALESCE($5, bin_location),
                  batch_number = COALESCE($6, batch_number),
                  remarks = COALESCE($7, remarks)
              WHERE id = $8
            `, [newAcc, delta, newPrice, newAcc * newPrice, newBin || null, newBatch || null, newRemarks || null, ledgerRow.id]);
          }

          if (grn.po_id && delta !== 0) {
            await client.query(`
              UPDATE po_items
              SET received_qty = GREATEST(0, COALESCE(received_qty, 0) + $1)
              WHERE po_id = $2 AND material_id = $3
            `, [delta, grn.po_id, existItem.material_id]);
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'GRN details and item pricing updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}));

// PUT /api/inventory/grn/:id/approve
router.put('/grn/:id/approve', auth, requireLevel(3), asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query(
      'SELECT * FROM grn WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!old.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'GRN not found' });
    }
    if (!['Received', 'QC Pending'].includes(old[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot approve GRN in status '${old[0].status}'` });
    }
    const { rows } = await client.query(
      `UPDATE grn SET status='Approved' WHERE id=$1 RETURNING *`, [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// PUT /api/inventory/grn/:id/reject — reverses accepted stock
router.put('/grn/:id/reject', auth, requireLevel(3), asyncRoute(async (req, res) => {
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: old } = await client.query(
      'SELECT * FROM grn WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!old.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'GRN not found' });
    }
    if (['Approved', 'Rejected'].includes(old[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot reject GRN in status '${old[0].status}'` });
    }
    const { rows } = await client.query(
      `UPDATE grn SET status='Rejected', remarks=COALESCE($1,remarks) WHERE id=$2 RETURNING *`,
      [reason || null, req.params.id]
    );
    const { rows: items } = await client.query(
      'SELECT * FROM grn_items WHERE grn_id=$1', [req.params.id]
    );
    for (const item of items) {
      if (Number(item.accepted_qty) <= 0) continue;
      const mat = await client.query(
        'SELECT current_stock FROM materials WHERE id=$1', [item.material_id]
      );
      const newStock = Math.max(0, Number(mat.rows[0].current_stock) - Number(item.accepted_qty));
      await client.query('UPDATE materials SET current_stock=$1 WHERE id=$2', [newStock, item.material_id]);
      await client.query(
        `INSERT INTO stock_ledger (material_id,date,transaction_type,reference_id,reference_type,out_qty,balance,remarks,created_by)
         VALUES ($1,NOW(),'GRN Reject',$2,'GRN',$3,$4,$5,$6)`,
        [item.material_id, req.params.id, item.accepted_qty, newStock, `GRN rejected: ${reason || ''}`, req.user.id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// Doc31 #20: full 2-step workflow now — raise (level3) does NOT touch stock, only approve (level4, different
// person) actually writes it. Was single-person direct write, real shrinkage-cover vector before this.

// POST /api/inventory/adjustment — RAISE a request, no stock change yet
router.post('/adjustment', auth, requireLevel(3), asyncRoute(async (req, res) => {
  const { material_id, qty, reason, bin_location, batch_number } = req.body;
  if (!material_id || qty === undefined || !reason) {
    return res.status(400).json({ success: false, message: 'material_id, qty, reason required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO adjustment_requests (material_id, qty, reason, bin_location, batch_number, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [material_id, qty, reason, bin_location || null, batch_number || null, req.user.id]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

// GET /api/inventory/adjustment — list pending/all requests
router.get('/adjustment', auth, asyncRoute(async (req, res) => {
  const { status } = req.query;
  const { rows } = await pool.query(
    `SELECT ar.*, m.name AS "materialName", m.current_stock AS "currentStock", u.name AS "requestedByName"
     FROM adjustment_requests ar
     JOIN materials m ON m.id = ar.material_id
     JOIN users u ON u.id = ar.requested_by
     ${status ? 'WHERE ar.status=$1' : ''} ORDER BY ar.created_at DESC`,
    status ? [status] : []
  );
  res.json({ success: true, data: rows });
}));

// PUT /api/inventory/adjustment/:id/approve — actually writes the stock change. Different person, level4+.
router.put('/adjustment/:id/approve', auth, requireLevel(4), asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [reqRow] } = await client.query(
      `SELECT * FROM adjustment_requests WHERE id=$1 AND status='Pending' FOR UPDATE`, [req.params.id]
    );
    if (!reqRow) { await client.query('ROLLBACK'); return res.json({ success: false, message: 'Request not found or already actioned' }); }
    if (reqRow.requested_by === req.user.id && req.user.role_level < 5) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Cannot approve your own adjustment request — needs different user (or admin override)' });
    }
    const mat = await client.query('SELECT current_stock FROM materials WHERE id=$1 FOR UPDATE', [reqRow.material_id]);
    if (!mat.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Material not found' }); }
    const adjQty = Number(reqRow.qty);
    const current = Number(mat.rows[0].current_stock);
    const newStock = current + adjQty;
    if (newStock < 0) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: 'Adjustment would result in negative stock' }); }
    await client.query('UPDATE materials SET current_stock=$1 WHERE id=$2', [newStock, reqRow.material_id]);
    const inQty  = adjQty > 0 ? adjQty  : null;
    const outQty = adjQty < 0 ? Math.abs(adjQty) : null;
    await client.query(
      `INSERT INTO stock_ledger (material_id,date,transaction_type,reference_type,reference_id,in_qty,out_qty,balance,bin_location,batch_number,remarks,created_by)
       VALUES ($1,NOW(),'Adjustment','AdjustmentRequest',$2,$3,$4,$5,$6,$7,$8,$9)`,
      [reqRow.material_id, reqRow.id, inQty, outQty, newStock, reqRow.bin_location, reqRow.batch_number, reqRow.reason, req.user.id]
    );
    await client.query(
      `UPDATE adjustment_requests SET status='Approved', approved_by=$1, approved_at=NOW() WHERE id=$2`,
      [req.user.id, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: { materialId: reqRow.material_id, oldStock: current, newStock, adjustment: adjQty } });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// PUT /api/inventory/adjustment/:id/reject
router.put('/adjustment/:id/reject', auth, requireLevel(4), asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE adjustment_requests SET status='Rejected', approved_by=$1, approved_at=NOW() WHERE id=$2 AND status='Pending' RETURNING *`,
    [req.user.id, req.params.id]
  );
  res.json({ success: !!rows.length, data: rows[0] });
}));

// GET /api/inventory/reorder-alerts — materials at or below reorder level
router.get('/reorder-alerts', auth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.code, m.name, m.uom,
            m.current_stock as "currentStock",
            m.reorder_level as "reorderLevel",
            m.min_stock as "minStock",
            mc.name as "categoryName",
            (m.reorder_level - m.current_stock) as deficit
     FROM materials m
     LEFT JOIN material_categories mc ON mc.id=m.category_id
     WHERE m.is_active=true AND m.current_stock <= m.reorder_level
     ORDER BY (m.reorder_level - m.current_stock) DESC`
  );
  res.json({ success: true, data: rows, count: rows.length });
}));

// Doc31 #9: require an approved indent or PO reference — no doc-less stock exit through this route.
router.post('/issue', auth, requireStore, asyncRoute(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { date, materialId, qty, reason, batchNumber, binLocation, remarks, referenceId, referenceType, shift: shiftIn } = req.body;
    if (!date || !materialId || !qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'date, materialId, and qty required' });
    }
    const shift = deriveShift(shiftIn);
    if (!referenceId || !['Indent', 'PO'].includes(referenceType)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'referenceId + referenceType (Indent|PO) required — no undocumented stock issue' });
    }
    if (referenceType === 'Indent') {
      const { rows: [ind] } = await client.query(`SELECT status FROM indents WHERE id=$1`, [referenceId]);
      if (!ind || ind.status !== 'Approved') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Referenced indent must be Approved' });
      }
    } else {
      const { rows: [po] } = await client.query(`SELECT status FROM purchase_orders WHERE id=$1`, [referenceId]);
      if (!po || po.status !== 'Approved') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Referenced PO must be Approved' });
      }
    }

    const materialRes = await client.query(`SELECT current_stock as "currentStock" FROM materials WHERE id = $1`, [materialId]);
    const currentStock = Number(materialRes.rows[0]?.currentStock || 0);
    const issueQty = Number(qty);

    if (currentStock < issueQty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    const nextStock = currentStock - issueQty;
    const materialRes2 = await client.query(`SELECT unit_price as "unitPrice", name FROM materials WHERE id = $1`, [materialId]);
    const unitPrice = Number(materialRes2.rows[0]?.unitPrice || 0);
    const materialName = materialRes2.rows[0]?.name || `material #${materialId}`;
    const txnValue = issueQty * unitPrice;
    const isHigh = txnValue > HIGH_VALUE || (currentStock > 0 && issueQty / currentStock > HIGH_PCT);

    await client.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [nextStock, materialId]);
    await client.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_id, reference_type, out_qty, balance, unit_price, value, batch_number, bin_location, remarks, created_by, shift, is_high_txn)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [materialId, date, 'Issue', referenceId, referenceType, issueQty, nextStock, unitPrice, txnValue, batchNumber || null, binLocation || null, remarks || reason || 'Material issue', req.user.id, shift, isHigh]
    );

    await client.query('COMMIT');
    if (isHigh) {
      await notifyHighTxn(pool, { direction: 'Outward', materialId, materialName, qty: issueQty, value: txnValue, shift, userId: req.user.id });
    }
    res.status(201).json({ success: true, data: { materialId, issuedQty: issueQty, balance: nextStock } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.use((err, req, res, next) => {
  if (err.code === '23505') return res.status(409).json({ success: false, message: 'Record already exists (duplicate)' });
  console.error(err);
  res.status(500).json({ success: false, message: 'Server error' });
});

module.exports = router;
