const express = require('express')
const router = express.Router()
const { pool, requireAuth, requireLevel, requireStore, requireStoreManager, ar } = require('../middleware/helpers')
const { publish, TOPICS } = require('../kafka')

// Helper: insert audit log row (inside a client transaction)
async function auditLog(client, { userId, action, module, recordId, oldData, newData, ip }) {
  await client.query(
    `INSERT INTO audit_log (user_id, action, module, record_id, old_data, new_data, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, action, module, recordId, oldData ? JSON.stringify(oldData) : null,
     newData ? JSON.stringify(newData) : null, ip || null]
  );
}

// Raw materials & chemicals store endpoint
router.get('/rawmaterials', requireAuth, ar(async (req, res) => {
  const { category, search, low_stock, scope } = req.query;
  const where = ['m.is_active = true'];
  const vals = [];

  // Default or requested scope: only raw materials, chemicals, waste paper, pulp
  if (scope !== 'all') {
    where.push(`(mc.type = 'Raw Material' OR mc.name ILIKE '%chemical%' OR mc.name ILIKE '%raw%' OR mc.name ILIKE '%pulp%' OR mc.name ILIKE '%waste%')`);
  }

  if (category) {
    vals.push(`%${category}%`);
    where.push(`(mc.name ILIKE $${vals.length} OR mc.code ILIKE $${vals.length})`);
  }

  if (low_stock === 'true') {
    where.push(`(m.current_stock <= m.min_stock)`);
  }

  if (search) {
    vals.push(`%${search}%`);
    where.push(`(m.name ILIKE $${vals.length} OR m.code ILIKE $${vals.length} OR mc.name ILIKE $${vals.length})`);
  }

  const query = `
    SELECT m.id, m.name, m.code, m.uom AS unit, m.current_stock, m.min_stock, m.unit_price,
           (m.current_stock * m.unit_price) AS valuation,
           mc.name AS "categoryName",
           mc.name AS category_name,
           mc.type AS category_type,
           (m.current_stock <= m.min_stock) AS "lowStock",
           (m.current_stock <= m.min_stock) AS lowstock
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE ${where.join(' AND ')}
    ORDER BY mc.name, m.name
  `;

  const { rows } = await pool.query(query, vals);

  // Compute live summary
  const totalItems = rows.length;
  const totalQty = rows.reduce((s, r) => s + parseFloat(r.current_stock || 0), 0);
  const totalValuation = rows.reduce((s, r) => s + parseFloat(r.valuation || 0), 0);
  const lowStockCount = rows.filter(r => r.lowStock).length;

  res.json({
    success: true,
    data: rows,
    summary: {
      totalItems,
      totalQty,
      totalValuation,
      lowStockCount
    }
  });
}));

// ── STORE MANAGEMENT REAL-TIME ANALYTICS DASHBOARD ─────────────────────────
router.get('/dashboard-analytics', requireAuth, ar(async (req, res) => {
  // 1. Core KPIs
  const kpiQuery = `
    SELECT
      COALESCE(SUM(m.current_stock * m.unit_price), 0) AS total_valuation,
      COALESCE(SUM(m.current_stock), 0) AS total_qty,
      COUNT(m.id) AS total_items,
      COUNT(CASE WHEN m.current_stock <= m.min_stock THEN 1 END) AS low_stock_count,
      COUNT(CASE WHEN m.current_stock <= 0 THEN 1 END) AS out_of_stock_count
    FROM materials m
    WHERE m.is_active = true
  `;
  const { rows: [kpiStats] } = await pool.query(kpiQuery);

  // 2. Today's movements
  const todayMovesQuery = `
    SELECT
      COALESCE(SUM(CASE WHEN transaction_type IN ('grn', 'in') THEN in_qty ELSE 0 END), 0) AS today_in_qty,
      COALESCE(SUM(CASE WHEN transaction_type IN ('grn', 'in') THEN value ELSE 0 END), 0) AS today_in_val,
      COUNT(CASE WHEN transaction_type IN ('grn', 'in') THEN 1 END) AS today_in_count,
      COALESCE(SUM(CASE WHEN transaction_type IN ('issue', 'out') THEN out_qty ELSE 0 END), 0) AS today_out_qty,
      COALESCE(SUM(CASE WHEN transaction_type IN ('issue', 'out') THEN value ELSE 0 END), 0) AS today_out_val,
      COUNT(CASE WHEN transaction_type IN ('issue', 'out') THEN 1 END) AS today_out_count
    FROM stock_ledger
    WHERE date = CURRENT_DATE
  `;
  const { rows: [todayMoves] } = await pool.query(todayMovesQuery);

  // 3. Pending Indents & GRNs
  const pendingIndentsQuery = `
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(total_value), 0) AS value
    FROM indents
    WHERE status IN ('Submitted', 'L1 Approved', 'L2 Approved', 'L3 Approved', 'Approved', 'Partially Issued')
  `;
  const { rows: [pendingIndents] } = await pool.query(pendingIndentsQuery);

  // 4. Category-wise valuation & distribution
  const categoryQuery = `
    SELECT
      COALESCE(mc.name, 'General Store') AS category_name,
      COALESCE(mc.code, 'GEN') AS category_code,
      COALESCE(mc.type, 'General') AS category_type,
      COUNT(m.id) AS item_count,
      COALESCE(SUM(m.current_stock), 0) AS total_qty,
      COALESCE(SUM(m.current_stock * m.unit_price), 0) AS valuation
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE m.is_active = true
    GROUP BY mc.name, mc.code, mc.type
    ORDER BY valuation DESC
  `;
  const { rows: categoryRows } = await pool.query(categoryQuery);
  const grandVal = parseFloat(kpiStats?.total_valuation || 1);
  const categories = categoryRows.map(c => ({
    categoryName: c.category_name,
    categoryCode: c.category_code,
    categoryType: c.category_type,
    itemCount: parseInt(c.item_count),
    totalQty: parseFloat(c.total_qty),
    valuation: parseFloat(c.valuation),
    percentage: grandVal > 0 ? parseFloat(((parseFloat(c.valuation) / grandVal) * 100).toFixed(2)) : 0
  }));

  // 5. 14-Day Inward vs Outward Movement Trend
  const trendQuery = `
    SELECT
      TO_CHAR(d::date, 'YYYY-MM-DD') AS date,
      TO_CHAR(d::date, 'Mon DD') AS label,
      COALESCE(SUM(CASE WHEN sl.transaction_type IN ('grn', 'in') THEN sl.in_qty ELSE 0 END), 0) AS inward_qty,
      COALESCE(SUM(CASE WHEN sl.transaction_type IN ('issue', 'out') THEN sl.out_qty ELSE 0 END), 0) AS outward_qty,
      COALESCE(SUM(CASE WHEN sl.transaction_type IN ('grn', 'in') THEN sl.value ELSE 0 END), 0) AS inward_val,
      COALESCE(SUM(CASE WHEN sl.transaction_type IN ('issue', 'out') THEN sl.value ELSE 0 END), 0) AS outward_val
    FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day'::interval) d
    LEFT JOIN stock_ledger sl ON DATE(sl.date) = d::date
    GROUP BY d::date
    ORDER BY d::date ASC
  `;
  const { rows: trendRows } = await pool.query(trendQuery);

  // 6. Department Consumption Share (Current Month)
  const deptQuery = `
    SELECT
      d.name AS department_name,
      COUNT(DISTINCT i.id) AS issue_count,
      COALESCE(SUM(ii.issued_qty), 0) AS total_qty,
      COALESCE(SUM(COALESCE(ii.line_value, i.total_value, 0)), 0) AS total_val
    FROM departments d
    LEFT JOIN indents i ON i.department_id = d.id AND i.status IN ('Issued', 'Partially Issued', 'Approved') AND i.date >= DATE_TRUNC('month', CURRENT_DATE)
    LEFT JOIN indent_items ii ON ii.indent_id = i.id
    GROUP BY d.name
    ORDER BY total_val DESC, issue_count DESC
    LIMIT 8
  `;
  const { rows: deptRows } = await pool.query(deptQuery);
  const totalDeptVal = deptRows.reduce((acc, r) => acc + parseFloat(r.total_val || 0), 0) || 1;
  const departments = deptRows.map(d => ({
    departmentName: d.department_name,
    issueCount: parseInt(d.issue_count || 0),
    totalQty: parseFloat(d.total_qty || 0),
    totalValue: parseFloat(d.total_val || 0),
    percentage: parseFloat(((parseFloat(d.total_val || 0) / totalDeptVal) * 100).toFixed(1))
  }));

  // 7. Criticality (ABC Classification) & Health Matrix
  const critQuery = `
    SELECT
      COALESCE(criticality_class, 'C') AS crit_class,
      COUNT(*) AS count,
      COALESCE(SUM(current_stock * unit_price), 0) AS valuation,
      COUNT(CASE WHEN current_stock <= min_stock THEN 1 END) AS low_stock_count
    FROM materials
    WHERE is_active = true
    GROUP BY COALESCE(criticality_class, 'C')
  `;
  const { rows: critRows } = await pool.query(critQuery);
  const criticality = {
    A: { count: 0, valuation: 0, lowStock: 0 },
    B: { count: 0, valuation: 0, lowStock: 0 },
    C: { count: 0, valuation: 0, lowStock: 0 }
  };
  critRows.forEach(r => {
    const k = r.crit_class || 'C';
    if (criticality[k]) {
      criticality[k] = {
        count: parseInt(r.count),
        valuation: parseFloat(r.valuation),
        lowStock: parseInt(r.low_stock_count)
      };
    }
  });

  // 8. Top Moving Materials (Fastest Turnover in last 30 days)
  const topMovingQuery = `
    SELECT
      m.id,
      m.name,
      m.code,
      m.uom,
      m.current_stock,
      m.unit_price,
      (m.current_stock * m.unit_price) AS valuation,
      COALESCE(mc.name, 'General') AS category_name,
      COUNT(sl.id) AS movement_count,
      COALESCE(SUM(CASE WHEN sl.transaction_type IN ('issue', 'out') THEN sl.out_qty ELSE 0 END), 0) AS total_issued_qty,
      COALESCE(SUM(sl.value), 0) AS total_turnover_val
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN stock_ledger sl ON sl.material_id = m.id AND sl.date >= CURRENT_DATE - INTERVAL '30 days'
    WHERE m.is_active = true
    GROUP BY m.id, m.name, m.code, m.uom, m.current_stock, m.unit_price, mc.name
    ORDER BY movement_count DESC, total_turnover_val DESC, valuation DESC
    LIMIT 8
  `;
  const { rows: topMovingRows } = await pool.query(topMovingQuery);

  // 9. Dead Stock / Slow-Moving Capital (>60 days inactive)
  const deadStockQuery = `
    SELECT
      COUNT(m.id) AS dead_items_count,
      COALESCE(SUM(m.current_stock * m.unit_price), 0) AS dead_capital_value
    FROM materials m
    WHERE m.is_active = true
      AND m.current_stock > 0
      AND m.id NOT IN (
        SELECT DISTINCT material_id FROM stock_ledger WHERE date >= CURRENT_DATE - INTERVAL '60 days' AND material_id IS NOT NULL
      )
  `;
  const { rows: [deadStock] } = await pool.query(deadStockQuery);

  res.json({
    success: true,
    data: {
      kpis: {
        totalStockValuation: parseFloat(kpiStats?.total_valuation || 0),
        totalStockQty: parseFloat(kpiStats?.total_qty || 0),
        totalCatalogItems: parseInt(kpiStats?.total_items || 0),
        lowStockCount: parseInt(kpiStats?.low_stock_count || 0),
        outOfStockCount: parseInt(kpiStats?.out_of_stock_count || 0),
        todayInwardCount: parseInt(todayMoves?.today_in_count || 0),
        todayInwardQty: parseFloat(todayMoves?.today_in_qty || 0),
        todayInwardVal: parseFloat(todayMoves?.today_in_val || 0),
        todayOutwardCount: parseInt(todayMoves?.today_out_count || 0),
        todayOutwardQty: parseFloat(todayMoves?.today_out_qty || 0),
        todayOutwardVal: parseFloat(todayMoves?.today_out_val || 0),
        pendingIndentsCount: parseInt(pendingIndents?.count || 0),
        pendingIndentsVal: parseFloat(pendingIndents?.value || 0),
        deadStockCount: parseInt(deadStock?.dead_items_count || 0),
        deadStockVal: parseFloat(deadStock?.dead_capital_value || 0)
      },
      categories,
      movementTrend: trendRows.map(r => ({
        date: r.date,
        label: r.label,
        inwardQty: parseFloat(r.inward_qty),
        outwardQty: parseFloat(r.outward_qty),
        inwardVal: parseFloat(r.inward_val),
        outwardVal: parseFloat(r.outward_val),
        netQty: parseFloat(r.inward_qty) - parseFloat(r.outward_qty)
      })),
      departments,
      criticality,
      topMovingMaterials: topMovingRows.map(r => ({
        id: r.id,
        name: r.name,
        code: r.code,
        uom: r.uom,
        currentStock: parseFloat(r.current_stock),
        unitPrice: parseFloat(r.unit_price),
        valuation: parseFloat(r.valuation),
        categoryName: r.category_name,
        movementCount: parseInt(r.movement_count),
        totalIssuedQty: parseFloat(r.total_issued_qty),
        totalTurnoverVal: parseFloat(r.total_turnover_val)
      }))
    }
  });
}));

// List store issues / indents (unified with organization indents & store requests)
router.get('/issues', requireAuth, ar(async (req, res) => {
  const { from, to, status, departmentId } = req.query;
  const where = ['1=1'];
  const vals = [];

  if (from) { vals.push(from); where.push(`i.date >= $${vals.length}`); }
  if (to)   { vals.push(to);   where.push(`i.date <= $${vals.length}`); }
  if (status) {
    if (status === 'Pending') {
      vals.push('Submitted');
      where.push(`i.status = $${vals.length}`);
    } else {
      vals.push(status);
      where.push(`i.status = $${vals.length}`);
    }
  }
  if (departmentId && departmentId !== 'all' && departmentId !== 'undefined') {
    vals.push(parseInt(departmentId));
    where.push(`i.department_id = $${vals.length}`);
  }

  const { rows } = await pool.query(`
    SELECT
      i.id,
      i.indent_number AS issue_number,
      i.indent_number AS "issueNumber",
      i.date AS issue_date,
      i.date AS "createdAt",
      i.department_id,
      d.name AS "departmentName",
      d.name AS department_name,
      u.name AS "requestedByName",
      u.name AS requested_by_name,
      i.priority,
      i.status,
      i.remarks,
      i.remarks AS purpose,
      i.remarks AS justification,
      i.created_at,
      i.total_value AS estimated_value,
      COALESCE(items_agg.item_count, 0) AS item_count,
      COALESCE(items_agg.total_qty, 0) AS quantity,
      items_agg.material_names AS "materialName",
      items_agg.material_names AS material_name,
      items_agg.primary_material_id AS material_id,
      items_agg.primary_unit AS unit,
      items_agg.items_json AS items
    FROM indents i
    LEFT JOIN departments d ON i.department_id = d.id
    LEFT JOIN users u ON i.raised_by = u.id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(ii.id) AS item_count,
        SUM(ii.required_qty) AS total_qty,
        STRING_AGG(m.name, ', ' ORDER BY ii.id) AS material_names,
        MIN(ii.material_id) AS primary_material_id,
        MIN(ii.uom) AS primary_unit,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ii.id,
            'material_id', ii.material_id,
            'materialName', m.name,
            'materialCode', m.code,
            'required_qty', ii.required_qty,
            'issued_qty', ii.issued_qty,
            'uom', ii.uom,
            'purpose', ii.purpose,
            'batch_no', ii.batch_no,
            'unit_price', m.unit_price,
            'current_stock', m.current_stock
          ) ORDER BY ii.id
        ) AS items_json
      FROM indent_items ii
      LEFT JOIN materials m ON ii.material_id = m.id
      WHERE ii.indent_id = i.id
    ) items_agg ON true
    WHERE ${where.join(' AND ')}
    ORDER BY i.created_at DESC
    LIMIT 200
  `, vals);

  res.json({ success: true, data: rows });
}));

// Dept-wise issue summary (step 11 tracking — "material issued to us this month")
router.get('/issues/dept-summary', requireAuth, ar(async (req, res) => {
  const { from, to } = req.query;
  const vals = [];
  const where = ["i.status IN ('Issued', 'Partially Issued')"];
  if (from) { vals.push(from); where.push(`i.date >= $${vals.length}`); }
  else      { where.push(`i.date >= date_trunc('month', CURRENT_DATE)`); }
  if (to)   { vals.push(to);   where.push(`i.date <= $${vals.length}`); }
  // Confidentiality: non-admins only ever see their own department's data, regardless of any client param
  if (req.user.role_level < 4 && req.user.dept_code !== 'STORE') {
    vals.push(req.user.department_id);
    where.push(`i.department_id = $${vals.length}`);
  }

  const { rows } = await pool.query(`
    SELECT d.id AS "departmentId", d.name AS "departmentName",
           COUNT(DISTINCT i.id)::int AS "issueCount",
           COALESCE(SUM(ii.issued_qty), 0) AS "totalQuantity",
           COALESCE(SUM(ii.line_value), 0) AS "totalValue"
    FROM indents i
    JOIN indent_items ii ON i.id = ii.indent_id
    LEFT JOIN departments d ON i.department_id = d.id
    WHERE ${where.join(' AND ')}
    GROUP BY d.id, d.name
    ORDER BY d.name
  `, vals);
  res.json({ success: true, data: rows });
}));

// Update a pending/rejected issue request / indent
router.put('/issues/:id', requireAuth, ar(async (req, res) => {
  const { materialId, departmentId, quantity, purpose, remarks, priority } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query('SELECT * FROM indents WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (ind) {
      if (!['Draft', 'Submitted', 'Rejected'].includes(ind.status)) {
        throw new Error('Only Draft, Submitted or Rejected indents can be edited');
      }
      await client.query(`
        UPDATE indents SET
          department_id = COALESCE($1, department_id),
          priority = COALESCE($2, priority),
          remarks = COALESCE($3, remarks),
          status = 'Submitted'
        WHERE id = $4
      `, [departmentId || null, priority || null, remarks || purpose || null, req.params.id]);

      if (materialId && quantity) {
        const mat = await client.query('SELECT uom, unit_price FROM materials WHERE id=$1', [materialId]);
        const uom = mat.rows[0]?.uom || 'Nos';
        await client.query(`
          UPDATE indent_items SET material_id=$1, required_qty=$2, uom=$3, purpose=$4 WHERE indent_id=$5
        `, [materialId, quantity, uom, purpose || null, req.params.id]);
      }
      await client.query('COMMIT');
      return res.json({ success: true, data: { id: req.params.id } });
    }

    // Fallback store_issues
    const { rows: [si] } = await client.query('SELECT * FROM store_issues WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!si) throw new Error('Request not found');
    await client.query(`
      UPDATE store_issues SET
        material_id = COALESCE($1, material_id),
        department_id = COALESCE($2, department_id),
        quantity = COALESCE($3, quantity),
        purpose = COALESCE($4, purpose),
        remarks = COALESCE($5, remarks),
        status = 'Pending'
      WHERE id = $6
    `, [materialId || null, departmentId || null, quantity || null, purpose || null, remarks || null, req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true, data: { id: req.params.id } });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally { client.release(); }
}));

// DELETE /api/store/issues/:id — Full DML Delete / Cancel Indent or Store Issue Request
router.delete('/issues/:id', requireAuth, ar(async (req, res) => {
  const isStore = req.user.dept_code === 'STORE' || ['Store Management', 'Raw Material Store', 'Inventory', 'Store'].includes(req.user.department);
  const isElevated = (req.user.role_level || 1) >= 4;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query('SELECT * FROM indents WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (ind) {
      if (ind.status === 'Issued' || ind.status === 'Closed') {
        throw new Error('Cannot delete an already issued or closed indent');
      }
      await client.query('DELETE FROM indent_items WHERE indent_id = $1', [req.params.id]);
      await client.query('DELETE FROM indent_audit_log WHERE indent_id = $1', [req.params.id]);
      await client.query('DELETE FROM store_indent_log WHERE indent_id = $1', [req.params.id]);
      await client.query('DELETE FROM indents WHERE id = $1', [req.params.id]);

      await client.query('COMMIT');
      publish(TOPICS.EVENTS_ALL, `indent-${req.params.id}`, { event: 'indent.deleted', id: req.params.id, userId: req.user.id });
      return res.json({ success: true, message: `Indent ${ind.indent_number} deleted successfully` });
    }

    const { rows: [si] } = await client.query('SELECT * FROM store_issues WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (si) {
      await client.query('DELETE FROM store_issues WHERE id = $1', [req.params.id]);
      await client.query('COMMIT');
      publish(TOPICS.EVENTS_ALL, `issue-${req.params.id}`, { event: 'store.issue.deleted', id: req.params.id, userId: req.user.id });
      return res.json({ success: true, message: 'Issue request deleted successfully' });
    }

    await client.query('ROLLBACK');
    res.status(404).json({ success: false, message: 'Indent or request not found' });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally { client.release(); }
}));

// Create issue / indent request
router.post('/issues', requireAuth, ar(async (req, res) => {
  const { materialId, departmentId, quantity, purpose, remarks, priority, machine_id, position_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`indent-${dateStr}`]);
    const { rows: seqRows } = await client.query(
      `SELECT LPAD((COALESCE(MAX(NULLIF(regexp_replace(indent_number, '^IND-[0-9]+-', ''), '')), '0')::int + 1)::text, 4, '0') AS seq
       FROM indents WHERE indent_number LIKE $1`,
      [`IND-${dateStr}-%`]
    );
    const num = `IND-${dateStr}-${seqRows[0].seq}`;

    const { rows: [newInd] } = await client.query(`
      INSERT INTO indents (
        indent_number, date, department_id, priority, status, raised_by, remarks, machine_id
      ) VALUES ($1, CURRENT_DATE, $2, $3, 'Submitted', $4, $5, $6) RETURNING id, indent_number
    `, [num, departmentId || req.user.department_id, priority || 'Normal', req.user.id, remarks || purpose || null, machine_id || null]);

    if (materialId) {
      const mat = await client.query('SELECT uom, unit_price FROM materials WHERE id=$1', [materialId]);
      const uom = mat.rows[0]?.uom || 'NOS';
      await client.query(`
        INSERT INTO indent_items (indent_id, material_id, required_qty, uom, purpose)
        VALUES ($1, $2, $3, $4, $5)
      `, [newInd.id, materialId, quantity || 1, uom, purpose || null]);
    }

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `indent-${newInd.id}`, { event: 'indent.created', id: newInd.id, indentNumber: num, userId: req.user.id });
    res.json({ success: true, data: { id: newInd.id, issueNumber: num, indentNumber: num } });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally { client.release(); }
}));

// Approve + Issue + deduct stock + auto-create Installed Assets if serialized
router.put('/issues/:id/approve', requireAuth, requireLevel(2), ar(async (req, res) => {
  const { serial_number, batch_number, issue_option, substitute_material_id, items: reqItems } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query(
      `SELECT * FROM indents WHERE id=$1 FOR UPDATE`, [req.params.id]
    );

    if (ind) {
      // Indent Approval or Issue Flow
      if (ind.status === 'Submitted' || ind.status === 'L1 Approved') {
        // Direct L2 approval
        await client.query(`
          UPDATE indents SET status='Approved', l2_approved_by=$1, l2_approved_at=NOW()
          WHERE id=$2
        `, [req.user.id, ind.id]);
        await client.query('COMMIT');
        publish(TOPICS.EVENTS_ALL, `indent-${ind.id}`, { event: 'indent.approved', id: ind.id, userId: req.user.id });
        return res.json({ success: true, message: 'Indent approved successfully' });
      }

      if (ind.status === 'Approved' || ind.status === 'Partially Issued' || (req.user.dept_code === 'STORE' || req.user.role_level >= 4)) {
        // Store Manager Issue Execution
        const { rows: indItems } = await client.query(
          `SELECT * FROM indent_items WHERE indent_id=$1`, [ind.id]
        );
        for (const item of indItems) {
          const issQty = parseFloat(item.required_qty);
          const { rows: [mat] } = await client.query(`SELECT current_stock, unit_price, is_serialized, expected_lifespan_days FROM materials WHERE id=$1 FOR UPDATE`, [item.material_id]);
          const currStock = parseFloat(mat?.current_stock || 0);
          if (currStock < issQty) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Insufficient stock for material ID ${item.material_id}. Available: ${currStock}, Requested: ${issQty}` });
          }
          await client.query(`UPDATE materials SET current_stock = current_stock - $1 WHERE id=$2`, [issQty, item.material_id]);
          const unitPrice = parseFloat(mat?.unit_price || 0);
          const newBal = currStock - issQty;

          await client.query(`
            INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, out_qty, balance, unit_price, value, batch_number, remarks, created_by)
            VALUES ($1, CURRENT_DATE, 'issue', 'indent', $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            item.material_id, ind.id, issQty, newBal, unitPrice,
            issQty * unitPrice, batch_number || serial_number || null,
            `Store Issue for Indent ${ind.indent_number}`, req.user.id
          ]);

          await client.query(`
            UPDATE indent_items SET issued_qty=$1, batch_no=$2, unit_price=$3, line_value=$4, ack_status='pending' WHERE id=$5
          `, [issQty, batch_number || serial_number || null, unitPrice, issQty * unitPrice, item.id]);

          // Digital Twin: Auto-create Installed Assets row if serialized or machine provided
          if (mat?.is_serialized || serial_number || ind.machine_id) {
            const today = new Date();
            const dateStr = today.toISOString().slice(0,10).replace(/-/g, '');
            const { rows: assetSeq } = await client.query(
              `SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq FROM installed_assets`
            );
            const assetNumber = `AST-${dateStr}-${assetSeq[0].seq}`;
            await client.query(`
              INSERT INTO installed_assets (
                asset_number, material_id, serial_number, batch_number, machine_id,
                indent_id, requested_by, approved_by, issued_by, purchase_price, installed_at, status, expected_lifespan_days
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),'active',$11)
            `, [
              assetNumber, item.material_id, serial_number || batch_number || `SN-${Date.now()}`,
              batch_number || null, ind.machine_id || null, ind.id, ind.raised_by || req.user.id,
              req.user.id, req.user.id, unitPrice, mat?.expected_lifespan_days || 365
            ]);
          }
        }

        await client.query(`
          UPDATE indents SET status='Issued', issued_by=$1, issued_at=NOW() WHERE id=$2
        `, [req.user.id, ind.id]);

        await client.query('COMMIT');
        publish(TOPICS.EVENTS_ALL, `indent-${ind.id}`, { event: 'indent.issued', id: ind.id, userId: req.user.id });
        return res.json({ success: true, message: 'Indent issued and stock deducted successfully' });
      }
    }

    // Fallback store_issues
    const { rows: [si] } = await client.query('SELECT * FROM store_issues WHERE id=$1', [req.params.id]);
    if (!si) throw new Error('Request not found');
    const mat = await client.query('SELECT current_stock, is_serialized, expected_lifespan_days, unit_price FROM materials WHERE id=$1', [si.material_id]);
    const material = mat.rows[0];
    if (parseFloat(material.current_stock) < parseFloat(si.quantity)) throw new Error('Insufficient stock in store');

    await client.query(`UPDATE materials SET current_stock = current_stock - $1 WHERE id=$2`, [si.quantity, si.material_id]);
    const newBal = parseFloat(material.current_stock) - parseFloat(si.quantity);
    const price = parseFloat(material.unit_price || 0);

    await client.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, reference_type, reference_id, out_qty, balance, unit_price, value, batch_number, remarks, created_by)
      VALUES ($1, CURRENT_DATE, 'issue', 'indent', $2, $3, $4, $5, $6, $7, 'Store issue', $8)
    `, [si.material_id, si.id, si.quantity, newBal, price, price * parseFloat(si.quantity), batch_number || serial_number || null, req.user.id]);

    await client.query(`
      UPDATE store_issues SET status='Issued', approved_by=$1, serial_number=$2, batch_number=$3 WHERE id=$4
    `, [req.user.id, serial_number || null, batch_number || null, req.params.id]);

    if (material.is_serialized || serial_number || si.machine_id) {
      const today = new Date();
      const dateStr = today.toISOString().slice(0,10).replace(/-/g, '');
      const { rows: assetSeq } = await client.query(`SELECT LPAD((COUNT(*) + 1)::text, 4, '0') AS seq FROM installed_assets`);
      const assetNumber = `AST-${dateStr}-${assetSeq[0].seq}`;
      await client.query(`
        INSERT INTO installed_assets (
          asset_number, material_id, serial_number, batch_number, machine_id, position_id,
          requested_by, approved_by, issued_by, purchase_price, installed_at, status, expected_lifespan_days
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),'active',$11)
      `, [
        assetNumber, si.material_id, serial_number || batch_number || `SN-${Date.now()}`,
        batch_number || null, si.machine_id || null, si.position_id || null, si.issued_by || req.user.id,
        req.user.id, req.user.id, price, material.expected_lifespan_days || 365
      ]);
    }

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `issue-${req.params.id}`, { event: 'store.issue.approved', id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally { client.release(); }
}));

// Reject
router.put('/issues/:id/reject', requireAuth, requireLevel(2), ar(async (req, res) => {
  const { rejection_reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query('SELECT id FROM indents WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (ind) {
      await client.query(`UPDATE indents SET status='Rejected', remarks=COALESCE($1, remarks) WHERE id=$2`, [rejection_reason || null, req.params.id]);
      await client.query('COMMIT');
      publish(TOPICS.EVENTS_ALL, `indent-${req.params.id}`, { event: 'indent.rejected', id: req.params.id, userId: req.user.id });
      return res.json({ success: true });
    }
    await client.query(`UPDATE store_issues SET status='Rejected', remarks=COALESCE($1, remarks) WHERE id=$2`, [rejection_reason || null, req.params.id]);
    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `issue-${req.params.id}`, { event: 'store.issue.rejected', id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally { client.release(); }
}));

// ── INSTALLED ASSETS TERM & ROOT CAUSE QUERIES ─────────────────────────────────

// GET /assets - list installed assets & Paper Machine Clothing
router.get('/assets', requireAuth, ar(async (req, res) => {
  const { machine_id, status, is_clothing } = req.query;
  const conds = []; const params = []; let p = 1;
  if (machine_id) { conds.push(`a.machine_id = $${p++}`); params.push(machine_id); }
  if (status) { conds.push(`a.status = $${p++}`); params.push(status); }
  if (is_clothing === 'true') {
    conds.push(`(m.is_serialized = true OR mc.name ILIKE '%cloth%' OR m.name ILIKE '%felt%' OR m.name ILIKE '%wire%' OR m.name ILIKE '%screen%')`);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const { rows } = await pool.query(
    `SELECT a.id, a.asset_number as "assetNumber", a.serial_number as "serialNumber",
            a.batch_number as "batchNumber", a.purchase_price as "purchasePrice",
            a.installed_at as "installedAt", a.retired_at as "retiredAt", a.status,
            a.expected_lifespan_days as "expectedLifespanDays", a.failure_reason as "failureReason",
            m.id as "materialId", m.name as "materialName", m.code as "materialCode", m.uom,
            mc.name as "categoryName",
            mach.id as "machineId", mach.name as "machineName",
            pos.id as "positionId", pos.name as "positionName", pos.code as "positionCode",
            v.name as "vendorName",
            COALESCE(EXTRACT(DAY FROM (COALESCE(a.retired_at, NOW()) - a.installed_at))::int, 0) as "daysInService",
            CASE
              WHEN a.status = 'retired' THEN 'Retired'
              WHEN a.status = 'In Stock' THEN 'In Stock (Warehouse)'
              WHEN a.installed_at IS NULL THEN 'Unassigned'
              WHEN EXTRACT(DAY FROM (NOW() - a.installed_at)) >= a.expected_lifespan_days THEN 'Overdue Replacement'
              WHEN EXTRACT(DAY FROM (NOW() - a.installed_at)) >= (a.expected_lifespan_days * 0.8) THEN 'Critical (Near End of Life)'
              ELSE 'Optimal Running Life'
            END as "lifespanHealthStatus",
            CASE
              WHEN a.status = 'In Stock' THEN 100
              WHEN a.installed_at IS NULL THEN 100
              ELSE GREATEST(0, LEAST(100, ROUND(((a.expected_lifespan_days - EXTRACT(DAY FROM (COALESCE(a.retired_at, NOW()) - a.installed_at))) / NULLIF(a.expected_lifespan_days, 0)) * 100)))::int
            END as "healthPct",
            ROUND((a.purchase_price / NULLIF(COALESCE(EXTRACT(DAY FROM (COALESCE(a.retired_at, NOW()) - a.installed_at)), a.expected_lifespan_days, 1), 0))::numeric, 2) as "costPerDay"
     FROM installed_assets a
     JOIN materials m ON a.material_id = m.id
     LEFT JOIN material_categories mc ON m.category_id = mc.id
     LEFT JOIN machines mach ON a.machine_id = mach.id
     LEFT JOIN machine_positions pos ON a.position_id = pos.id
     LEFT JOIN vendors v ON a.vendor_id = v.id
     ${where} 
     ORDER BY 
       CASE WHEN a.status = 'active' THEN 1 WHEN a.status = 'In Stock' THEN 2 ELSE 3 END,
       COALESCE(a.installed_at, a.created_at) DESC`,
    params
  );
  res.json({ success: true, data: rows });
}));

// POST /assets/:id/retire - fail/remove asset
router.post('/assets/:id/retire', requireAuth, ar(async (req, res) => {
  const { status, failure_reason } = req.body;
  if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE installed_assets
       SET status=$1, retired_at=NOW(), failure_reason=$2
       WHERE id=$3 RETURNING *`,
      [status, failure_reason || null, req.params.id]
    );

    if (!rows.length) throw new Error('Asset not found');

    await client.query(
      `INSERT INTO asset_events (asset_id, event_type, event_date, recorded_by, remarks)
       VALUES ($1, $2, NOW(), $3, $4)`,
      [req.params.id, status, req.user.id, failure_reason || 'Asset retired']
    );

    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally { client.release(); }
}));

// GET /positions - get active machine positions list
router.get('/positions', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, code, machine_id as "machineId" FROM machine_positions WHERE is_active=true ORDER BY name');
  res.json({ success: true, data: rows });
}));

// GET /positions/:id/history - lifespan history for a machine position
router.get('/positions/:id/history', requireAuth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.asset_number as "assetNumber", a.serial_number as "serialNumber",
            a.installed_at as "installedAt", a.retired_at as "retiredAt", a.status,
            a.failure_reason as "failureReason", m.name as "materialName",
            EXTRACT(DAY FROM (COALESCE(a.retired_at, NOW()) - a.installed_at))::int as "daysInService"
     FROM installed_assets a
     JOIN materials m ON a.material_id = m.id
     WHERE a.position_id = $1
     ORDER BY a.installed_at DESC`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
}));

// GET /lots/:lotNumber/trace - find all assets and failures associated with a lot/batch
router.get('/lots/:lotNumber/trace', requireAuth, ar(async (req, res) => {
  const lot = req.params.lotNumber.trim();
  const searchPattern = `%${lot}%`;

  const { rows } = await pool.query(
    `SELECT
      a.installed_at AS date,
      CASE WHEN a.status = 'Failed' THEN 'Asset Failure / Breakdown' ELSE 'Asset Installation (Digital Twin)' END AS transaction_type,
      m.name AS "materialName",
      m.code AS "materialCode",
      mach.name AS "machineName",
      pos.name AS "positionName",
      COALESCE(u.name, 'Store & Maintenance') AS actor_name,
      COALESCE(a.failure_reason, 'Installed in machine position: ' || COALESCE(pos.name, 'Main Line')) AS remarks,
      a.asset_number AS reference,
      1::numeric AS qty,
      a.status AS status,
      a.serial_number AS "serialNumber",
      a.batch_number AS "batchNumber"
    FROM installed_assets a
    JOIN materials m ON a.material_id = m.id
    LEFT JOIN machines mach ON a.machine_id = mach.id
    LEFT JOIN machine_positions pos ON a.position_id = pos.id
    LEFT JOIN users u ON a.issued_by = u.id
    WHERE a.batch_number ILIKE $1 OR a.serial_number ILIKE $1 OR a.asset_number ILIKE $1

    UNION ALL

    SELECT
      sl.date::timestamp AS date,
      'Stock Movement: ' || sl.transaction_type AS transaction_type,
      m.name AS "materialName",
      m.code AS "materialCode",
      NULL AS "machineName",
      NULL AS "positionName",
      COALESCE(u.name, 'System') AS actor_name,
      COALESCE(sl.remarks, 'Stock ledger entry') || ' (Balance: ' || sl.balance || ' ' || m.uom || ')' AS remarks,
      COALESCE(sl.reference_type, 'LEDGER') || ' #' || COALESCE(sl.reference_id::text, sl.id::text) AS reference,
      COALESCE(sl.in_qty, sl.out_qty, 0) AS qty,
      'Recorded' AS status,
      NULL AS "serialNumber",
      sl.batch_number AS "batchNumber"
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN users u ON sl.created_by = u.id
    WHERE sl.batch_number ILIKE $1 OR sl.remarks ILIKE $1

    UNION ALL

    SELECT
      g.created_at AS date,
      'Inward Intake (GRN)' AS transaction_type,
      m.name AS "materialName",
      m.code AS "materialCode",
      NULL AS "machineName",
      NULL AS "positionName",
      COALESCE(u.name, 'Store Gate Officer') AS actor_name,
      'Received from ' || COALESCE(v.name, 'Vendor') || ' | Inv: ' || COALESCE(g.invoice_number, 'N/A') || ' | Veh: ' || COALESCE(g.vehicle_number, 'N/A') AS remarks,
      g.grn_number AS reference,
      gi.received_qty AS qty,
      g.status AS status,
      NULL AS "serialNumber",
      gi.batch_number AS "batchNumber"
    FROM grn_items gi
    JOIN grn g ON gi.grn_id = g.id
    JOIN materials m ON gi.material_id = m.id
    LEFT JOIN vendors v ON g.vendor_id = v.id
    LEFT JOIN users u ON g.received_by = u.id
    WHERE gi.batch_number ILIKE $1 OR g.grn_number ILIKE $1 OR g.invoice_number ILIKE $1

    ORDER BY date DESC
    LIMIT 200`,
    [searchPattern]
  );
  res.json({ success: true, data: rows });
}));

// ─── P1: INDENT WORKFLOW ─────────────────────────────────────────────────────

// POST /indents — dept raises indent
router.post('/indents', requireAuth, ar(async (req, res) => {
  const { materialId, departmentId, qtyRequested, purpose, priority, remarks } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const d = new Date()
    const seq = await client.query(
      `SELECT COUNT(*)+1 AS n FROM store_indents WHERE indent_date::date = CURRENT_DATE`
    )
    const pad = (n, l) => String(n).padStart(l, '0')
    const num = `INDT-${d.getFullYear()}${pad(d.getMonth()+1,2)}${pad(d.getDate(),2)}-${pad(seq.rows[0].n,4)}`
    const mat = await client.query('SELECT uom AS unit FROM materials WHERE id=$1', [materialId])
    const unit = mat.rows[0]?.unit || null

    const ins = await client.query(`
      INSERT INTO store_indents
        (indent_number,department_id,material_id,qty_requested,unit,purpose,priority,remarks,requested_by,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Requested') RETURNING id
    `, [num, departmentId, materialId, qtyRequested, unit, purpose, priority||'Normal', remarks||null, req.user.id])
    const indentId = ins.rows[0].id

    await client.query(`
      INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role)
      VALUES ($1,'Raised',NULL,'Requested',$2,$3,$4)
    `, [indentId, req.user.id, req.user.name, req.user.role])

    await client.query('COMMIT')
    res.json({ success: true, data: { id: indentId, indentNumber: num, status: 'Requested' } })
  } catch(e) {
    await client.query('ROLLBACK')
    res.status(400).json({ success: false, message: e.message })
  } finally { client.release() }
}))

// GET /indents/:id — single indent + full progress timeline
router.get('/indents/:id', requireAuth, ar(async (req, res) => {
  const { rows: indRow } = await pool.query(`
    SELECT i.id, i.indent_number AS "indentNumber", i.indent_date AS "indentDate",
           i.qty_requested AS "qtyRequested", i.qty_issued AS "qtyIssued",
           i.unit, i.purpose, i.priority, i.status, i.remarks,
           i.reject_reason AS "rejectReason", i.created_at AS "createdAt",
           m.name AS "materialName", m.code AS "materialCode",
           d.name AS "departmentName",
           ru.name AS "requestedByName",
           au.name AS "approvedByName",
           iu.name AS "issuedByName"
    FROM store_indents i
    LEFT JOIN materials m ON i.material_id = m.id
    LEFT JOIN departments d ON i.department_id = d.id
    LEFT JOIN users ru ON i.requested_by = ru.id
    LEFT JOIN users au ON i.approved_by = au.id
    LEFT JOIN users iu ON i.issued_by = iu.id
    WHERE i.id = $1
  `, [req.params.id])
  if (!indRow[0]) return res.status(404).json({ success: false, message: 'Indent not found' })

  const { rows: timeline } = await pool.query(`
    SELECT action, from_status AS "fromStatus", to_status AS "toStatus",
           actor_name AS "actorName", actor_role AS "actorRole",
           qty, note, created_at AS "createdAt"
    FROM store_indent_log
    WHERE indent_id = $1
    ORDER BY created_at ASC
  `, [req.params.id])

  res.json({ success: true, data: { indent: indRow[0], timeline } })
}))

// GET /indents — list with filters
router.get('/indents', requireAuth, ar(async (req, res) => {
  const { from, to, status, departmentId } = req.query
  const vals = []
  const where = ['1=1']
  if (from)         { vals.push(from);         where.push(`i.indent_date >= $${vals.length}`) }
  if (to)           { vals.push(to);           where.push(`i.indent_date <= $${vals.length}`) }
  if (status)       { vals.push(status);       where.push(`i.status = $${vals.length}`) }
  if (departmentId) { vals.push(departmentId); where.push(`i.department_id = $${vals.length}`) }

  const { rows } = await pool.query(`
    SELECT i.id, i.indent_number AS "indentNumber", i.indent_date AS "indentDate",
           i.qty_requested AS "qtyRequested", i.qty_issued AS "qtyIssued",
           i.unit, i.purpose, i.priority, i.status, i.remarks, i.created_at AS "createdAt",
           m.name AS "materialName", m.code AS "materialCode",
           d.name AS "departmentName", u.name AS "requestedByName"
    FROM store_indents i
    LEFT JOIN materials m ON i.material_id = m.id
    LEFT JOIN departments d ON i.department_id = d.id
    LEFT JOIN users u ON i.requested_by = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY i.created_at DESC
  `, vals)
  res.json({ success: true, data: rows })
}))

// PUT /indents/:id/reject — supervisor rejects indent (PERMISSION GATE deny)
router.put('/indents/:id/reject', requireAuth, requireLevel(2), ar(async (req, res) => {
  const { reason } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT * FROM store_indents WHERE id=$1 FOR UPDATE', [req.params.id])
    const ind = rows[0]
    if (!ind) throw new Error('Not found')
    if (ind.status !== 'Requested') throw new Error('Only Requested indents can be rejected')

    await client.query(
      `UPDATE store_indents SET status='Rejected', reject_reason=$1, approved_by=$2, approved_at=NOW() WHERE id=$3`,
      [reason || null, req.user.id, ind.id]
    )
    await client.query(`
      INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,note)
      VALUES ($1,'Rejected','Requested','Rejected',$2,$3,$4,$5)
    `, [ind.id, req.user.id, req.user.name, req.user.role, reason || null])

    await client.query('COMMIT')
    res.json({ success: true })
  } catch(e) {
    await client.query('ROLLBACK')
    res.status(400).json({ success: false, message: e.message })
  } finally { client.release() }
}))

// PUT /indents/:id/approve — dept-scoped supervisor approves, maker != checker (matches indent.js strength)
router.put('/indents/:id/approve', requireAuth, requireLevel(3), ar(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT * FROM store_indents WHERE id=$1 FOR UPDATE', [req.params.id])
    const ind = rows[0]
    if (!ind) throw new Error('Not found')
    if (ind.status !== 'Requested') throw new Error('Only Requested indents can be approved')
    if (req.user.role_level < 4 && ind.department_id !== req.user.department_id) throw new Error('Can only approve indents from your own department (or level4+ override)')
    if (ind.requested_by === req.user.id && req.user.role_level < 4) throw new Error('Cannot approve own indent — needs different approver (or level4+ override)')

    await client.query(
      `UPDATE store_indents SET status='Approved', approved_by=$1, approved_at=NOW() WHERE id=$2`,
      [req.user.id, ind.id]
    )
    await client.query(`
      INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,note)
      VALUES ($1,'Approved','Requested','Approved',$2,$3,$4,$5)
    `, [ind.id, req.user.id, req.user.name, req.user.role, req.body.note||null])

    await client.query('COMMIT')
    res.json({ success: true })
  } catch(e) {
    await client.query('ROLLBACK')
    res.status(400).json({ success: false, message: e.message })
  } finally { client.release() }
}))

// PUT /indents/:id/issue — STORE ONLY issues stock (requireStore guard)
router.put('/indents/:id/issue', requireAuth, requireStore, ar(async (req, res) => {
  const { qty } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT * FROM store_indents WHERE id=$1 FOR UPDATE', [req.params.id])
    const ind = rows[0]
    if (!ind) throw new Error('Not found')
    if (ind.status !== 'Approved' && ind.status !== 'PartIssued')
      throw new Error('Only Approved/PartIssued indents can be issued')

    const currentIssued = parseFloat(ind.qty_issued || 0)
    const issueQty = parseFloat(qty || 0)
    if (issueQty <= 0) throw new Error('Issue quantity must be positive')

    const newIssued = currentIssued + issueQty
    const requested = parseFloat(ind.qty_requested)
    if (newIssued > requested) throw new Error('Cannot issue more than requested')

    // check material stock
    const m = await client.query('SELECT current_stock, unit_price FROM materials WHERE id=$1 FOR UPDATE', [ind.material_id])
    const material = m.rows[0]
    if (!material || parseFloat(material.current_stock) < issueQty)
      throw new Error('Insufficient stock in materials store')

    // deduct stock
    const nextStock = parseFloat(material.current_stock) - issueQty
    await client.query('UPDATE materials SET current_stock=$1 WHERE id=$2', [nextStock, ind.material_id])

    // log stock ledger (out)
    const ledgerSeq = await client.query('SELECT balance FROM stock_ledger WHERE material_id=$1 ORDER BY id DESC LIMIT 1', [ind.material_id])
    const bal = parseFloat(ledgerSeq.rows[0]?.balance || 0) - issueQty
    await client.query(`
      INSERT INTO stock_ledger (material_id, date, transaction_type, reference_id, reference_type, out_qty, balance, unit_price, value, remarks, created_by)
      VALUES ($1,CURRENT_DATE,'Issue',$2,'StoreIndent',$3,$4,$5,$6,$7,$8)
    `, [ind.material_id, ind.id, issueQty, bal, material.unit_price||0, issueQty * parseFloat(material.unit_price||0), `Issued against Indent ${ind.indent_number}`, req.user.id])

    const full = newIssued === requested
    const newStatus = full ? 'Issued' : 'PartIssued'

    await client.query(
      `UPDATE store_indents SET status=$1, qty_issued=$2, issued_by=$3, issued_at=NOW() WHERE id=$4`,
      [newStatus, newIssued, req.user.id, ind.id]
    )
    await client.query(`
      INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,qty_issued,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [ind.id, full?'Issued':'PartIssued', ind.status, newStatus, req.user.id, req.user.name, req.user.role, qty, req.body.note||null])

    await client.query('COMMIT')
    res.json({ success: true, data: { status: newStatus, qtyIssued: newIssued } })
  } catch(e) {
    await client.query('ROLLBACK')
    res.status(400).json({ success: false, message: e.message })
  } finally { client.release() }
}))

// PUT /indents/:id/close — dept acknowledge receipt
router.put('/indents/:id/close', requireAuth, ar(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT * FROM store_indents WHERE id=$1 FOR UPDATE', [req.params.id])
    const ind = rows[0]
    if (!ind) throw new Error('Not found')
    if (ind.status !== 'Issued') throw new Error('Only Issued indents can be closed')

    await client.query(
      `UPDATE store_indents SET status='Closed', closed_by=$1, closed_at=NOW() WHERE id=$2`,
      [req.user.id, ind.id]
    )
    await client.query(`
      INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,note)
      VALUES ($1,'Closed','Issued','Closed',$2,$3,$4,$5)
    `, [ind.id, req.user.id, req.user.name, req.user.role, req.body.note||null])

    await client.query('COMMIT')
    res.json({ success: true })
  } catch(e) {
    await client.query('ROLLBACK')
    res.status(400).json({ success: false, message: e.message })
  } finally { client.release() }
}))

// PUT /indents/:id/cancel — requester pulls back (Requested only)
router.put('/indents/:id/cancel', requireAuth, ar(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT * FROM store_indents WHERE id=$1 FOR UPDATE', [req.params.id])
    const ind = rows[0]
    if (!ind) throw new Error('Not found')
    if (ind.status !== 'Requested') throw new Error('Can only cancel Requested indents')
    if (ind.requested_by !== req.user.id && req.user.role_level < 4)
      throw new Error('Can only cancel your own indent')

    await client.query(`UPDATE store_indents SET status='Cancelled' WHERE id=$1`, [ind.id])
    await client.query(`
      INSERT INTO store_indent_log (indent_id,action,from_status,to_status,actor_id,actor_name,actor_role,note)
      VALUES ($1,'Cancelled','Requested','Cancelled',$2,$3,$4,$5)
    `, [ind.id, req.user.id, req.user.name, req.user.role, req.body.note||null])

    await client.query('COMMIT')
    res.json({ success: true })
  } catch(e) {
    await client.query('ROLLBACK')
    res.status(400).json({ success: false, message: e.message })
  } finally { client.release() }
}))

// GET /admin/progress — admin control tower (level 4+)
router.get('/admin/progress', requireAuth, requireLevel(4), ar(async (req, res) => {
  const { status, department_id, from, to } = req.query
  const vals = []
  const where = ['1=1']
  if (status)        { vals.push(status);        where.push(`i.status = $${vals.length}`) }
  if (department_id) { vals.push(department_id); where.push(`i.department_id = $${vals.length}`) }
  if (from)          { vals.push(from);          where.push(`i.indent_date >= $${vals.length}`) }
  if (to)            { vals.push(to);            where.push(`i.indent_date <= $${vals.length}`) }

  const { rows } = await pool.query(`
    SELECT i.id, i.indent_number, i.indent_date, i.status, i.priority,
           i.qty_requested, i.qty_issued, i.unit,
           m.name AS materialname,
           d.name AS departmentname,
           ru.name AS requestedbyname,
           au.name AS approvedbyname,
           iu.name AS issuedbyname,
           (SELECT l.action || ' by ' || l.actor_name
              FROM store_indent_log l WHERE l.indent_id=i.id
              ORDER BY l.created_at DESC LIMIT 1) AS laststep,
           (SELECT l.created_at FROM store_indent_log l WHERE l.indent_id=i.id
              ORDER BY l.created_at DESC LIMIT 1) AS laststepat
    FROM store_indents i
    LEFT JOIN materials m   ON i.material_id  = m.id
    LEFT JOIN departments d ON i.department_id = d.id
    LEFT JOIN users ru ON i.requested_by = ru.id
    LEFT JOIN users au ON i.approved_by  = au.id
    LEFT JOIN users iu ON i.issued_by    = iu.id
    WHERE ${where.join(' AND ')}
    ORDER BY i.created_at DESC LIMIT 200
  `, vals)

  const { rows: summary } = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM store_indents GROUP BY status`
  )
  const summaryMap = {}
  for (const r of summary) summaryMap[r.status] = r.count

  res.json({ success: true, data: { indents: rows, summary: summaryMap } })
}))

// ── INWARD DESK ─────────────────────────────────────────────────────────────
// GET /api/store/inward — Supports Master GRN Consolidated view (default) and Item Ledger view
router.get('/inward', requireAuth, ar(async (req, res) => {
  const { from, to, store_type, category_id, search, limit = 100, page = 1, view = 'master' } = req.query;

  if (view === 'items') {
    // Detailed Item Ledger View (per stock ledger line mutation)
    const where = ["sl.transaction_type IN ('grn', 'return', 'in')"];
    const vals = [];

    if (from) { vals.push(from); where.push(`sl.date >= $${vals.length}`); }
    if (to)   { vals.push(to);   where.push(`sl.date <= $${vals.length}`); }
    if (category_id) {
      vals.push(category_id);
      where.push(`m.category_id IN (SELECT id FROM material_categories WHERE id = $${vals.length} OR parent_id = $${vals.length})`);
    }
    if (store_type) {
      if (store_type === 'mechanical') {
        where.push(`(mc.type = 'Mechanical' OR mc.name = 'Mechanical' OR mc.parent_id IN (SELECT id FROM material_categories WHERE code = 'MECH' OR name = 'Mechanical'))`);
      } else if (store_type === 'electrical') {
        where.push(`(mc.type = 'Electrical' OR mc.name = 'Electrical' OR mc.parent_id IN (SELECT id FROM material_categories WHERE code = 'ELEC' OR name = 'Electrical'))`);
      } else if (store_type === 'chemical' || store_type === 'raw' || store_type === 'rawmaterial') {
        where.push(`(mc.name ILIKE '%chemical%' OR mc.type = 'Raw Material' OR mc.name ILIKE '%raw%' OR mc.name ILIKE '%pulp%' OR mc.name ILIKE '%waste%')`);
      } else if (store_type === 'consumable') {
        where.push(`(mc.type = 'Consumable' OR mc.name IN ('General', 'Stationary', 'Clothing', 'Packing'))`);
      }
    }
    if (search) {
      vals.push(`%${search}%`);
      where.push(`(m.name ILIKE $${vals.length} OR m.code ILIKE $${vals.length} OR sl.remarks ILIKE $${vals.length} OR sl.batch_number ILIKE $${vals.length} OR v.name ILIKE $${vals.length} OR po_v.name ILIKE $${vals.length} OR g_v.name ILIKE $${vals.length})`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = where.join(' AND ');

    const { rows } = await pool.query(`
      SELECT sl.id, sl.date, sl.material_id, sl.transaction_type, sl.reference_type, sl.reference_id,
             sl.in_qty, sl.balance, sl.unit_price, sl.value, sl.batch_number, sl.bin_location,
             sl.remarks, sl.created_at, sl.vendor_id,
             m.name AS "materialName", m.code AS "materialCode", m.uom, m.hsn_code AS "hsnCode",
             mc.name AS "categoryName",
             u.name AS "createdByName",
             COALESCE(v.name, po_v.name, g_v.name) AS "vendorName",
             COALESCE(v.code, po_v.code, g_v.code) AS "vendorCode",
             COALESCE(v.gstin, po_v.gstin, g_v.gstin) AS "vendorGstin",
             COALESCE(v.state, po_v.state, g_v.state) AS "vendorState",
             g.id AS "grnId", g.grn_number AS "grnNumber", g.status AS "grnStatus",
             g.vehicle_number AS "grnVehicleNumber", g.challan_number AS "grnChallanNumber",
             g.invoice_number AS "grnInvoiceNumber",
             COALESCE((SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id), 1)::int AS "grnItemCount"
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      LEFT JOIN material_categories mc ON m.category_id = mc.id
      LEFT JOIN users u ON sl.created_by = u.id
      LEFT JOIN vendors v ON sl.vendor_id = v.id
      LEFT JOIN purchase_orders po ON (sl.reference_type = 'PO' AND (sl.reference_id = po.id OR (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = po.id ELSE FALSE END)))
      LEFT JOIN vendors po_v ON po.vendor_id = po_v.id
      LEFT JOIN grn g ON (sl.reference_type = 'GRN' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = g.id ELSE FALSE END))
      LEFT JOIN vendors g_v ON g.vendor_id = g_v.id
      WHERE ${whereClause}
      ORDER BY sl.id DESC
      LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}
    `, [...vals, parseInt(limit), offset]);

    const countRes = await pool.query(`
      SELECT COUNT(*) as total_count, COALESCE(SUM(sl.in_qty), 0) as total_qty, COALESCE(SUM(sl.value), 0) as total_value
      FROM stock_ledger sl
      JOIN materials m ON sl.material_id = m.id
      LEFT JOIN material_categories mc ON m.category_id = mc.id
      LEFT JOIN vendors v ON sl.vendor_id = v.id
      LEFT JOIN purchase_orders po ON (sl.reference_type = 'PO' AND (sl.reference_id = po.id OR (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = po.id ELSE FALSE END)))
      LEFT JOIN vendors po_v ON po.vendor_id = po_v.id
      LEFT JOIN grn g ON (sl.reference_type = 'GRN' AND (CASE WHEN sl.reference_id::text ~ '^[0-9]+$' THEN sl.reference_id::int = g.id ELSE FALSE END))
      LEFT JOIN vendors g_v ON g.vendor_id = g_v.id
      WHERE ${whereClause}
    `, vals);

    const todayRes = await pool.query(`
      SELECT COUNT(*) as today_count, COALESCE(SUM(sl.in_qty), 0) as today_qty, COALESCE(SUM(sl.value), 0) as today_value
      FROM stock_ledger sl
      WHERE sl.transaction_type IN ('grn', 'return', 'in') AND sl.date = CURRENT_DATE
    `);

    return res.json({
      success: true,
      view: 'items',
      data: rows,
      total: parseInt(countRes.rows[0].total_count),
      summary: {
        totalCount: parseInt(countRes.rows[0].total_count),
        totalQty: parseFloat(countRes.rows[0].total_qty),
        totalValue: parseFloat(countRes.rows[0].total_value),
        todayCount: parseInt(todayRes.rows[0]?.today_count || 0),
        todayQty: parseFloat(todayRes.rows[0]?.today_qty || 0),
        todayValue: parseFloat(todayRes.rows[0]?.today_value || 0),
      }
    });
  }

  // Consolidated Master GRN View (1 row per GRN with all child items pre-aggregated)
  const where = ['g.id IS NOT NULL'];
  const vals = [];

  if (from) { vals.push(from); where.push(`g.date >= $${vals.length}`); }
  if (to)   { vals.push(to);   where.push(`g.date <= $${vals.length}`); }
  if (category_id) {
    vals.push(category_id);
    where.push(`EXISTS (SELECT 1 FROM grn_items gi JOIN materials m ON gi.material_id = m.id WHERE gi.grn_id = g.id AND m.category_id IN (SELECT id FROM material_categories WHERE id = $${vals.length} OR parent_id = $${vals.length}))`);
  }
  if (store_type) {
    if (store_type === 'mechanical') {
      where.push(`EXISTS (SELECT 1 FROM grn_items gi JOIN materials m ON gi.material_id = m.id LEFT JOIN material_categories mc ON m.category_id = mc.id WHERE gi.grn_id = g.id AND (mc.type = 'Mechanical' OR mc.name = 'Mechanical' OR mc.parent_id IN (SELECT id FROM material_categories WHERE code = 'MECH' OR name = 'Mechanical')))`);
    } else if (store_type === 'electrical') {
      where.push(`EXISTS (SELECT 1 FROM grn_items gi JOIN materials m ON gi.material_id = m.id LEFT JOIN material_categories mc ON m.category_id = mc.id WHERE gi.grn_id = g.id AND (mc.type = 'Electrical' OR mc.name = 'Electrical' OR mc.parent_id IN (SELECT id FROM material_categories WHERE code = 'ELEC' OR name = 'Electrical')))`);
    } else if (store_type === 'chemical' || store_type === 'raw' || store_type === 'rawmaterial') {
      where.push(`EXISTS (SELECT 1 FROM grn_items gi JOIN materials m ON gi.material_id = m.id LEFT JOIN material_categories mc ON m.category_id = mc.id WHERE gi.grn_id = g.id AND (mc.name ILIKE '%chemical%' OR mc.type = 'Raw Material' OR mc.name ILIKE '%raw%' OR mc.name ILIKE '%pulp%' OR mc.name ILIKE '%waste%'))`);
    } else if (store_type === 'consumable') {
      where.push(`EXISTS (SELECT 1 FROM grn_items gi JOIN materials m ON gi.material_id = m.id LEFT JOIN material_categories mc ON m.category_id = mc.id WHERE gi.grn_id = g.id AND (mc.type = 'Consumable' OR mc.name IN ('General', 'Stationary', 'Clothing', 'Packing')))`);
    }
  }
  if (search) {
    vals.push(`%${search}%`);
    where.push(`(g.grn_number ILIKE $${vals.length} OR g.invoice_number ILIKE $${vals.length} OR g.challan_number ILIKE $${vals.length} OR g.remarks ILIKE $${vals.length} OR v.name ILIKE $${vals.length} OR v.code ILIKE $${vals.length} OR v.gstin ILIKE $${vals.length} OR EXISTS (SELECT 1 FROM grn_items gi JOIN materials m ON gi.material_id = m.id WHERE gi.grn_id = g.id AND (m.name ILIKE $${vals.length} OR m.code ILIKE $${vals.length} OR gi.batch_number ILIKE $${vals.length})))`);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const whereClause = where.join(' AND ');

  const { rows } = await pool.query(`
    SELECT g.id, g.grn_number, g.date, g.status, g.vehicle_number, g.challan_number,
           g.invoice_number, g.order_number, g.order_date, g.remarks, g.created_at,
           COALESCE(g.total_taxable, (SELECT SUM(taxable_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0) AS total_taxable,
           COALESCE(g.total_gst, (SELECT SUM(cgst_amount + sgst_amount + igst_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0) AS total_gst,
           COALESCE(g.grand_total, (SELECT SUM(total_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0) AS grand_total,
           v.id AS "vendorId", v.name AS "vendorName", v.code AS "vendorCode",
           v.gstin AS "vendorGstin", v.state AS "vendorState", v.city AS "vendorCity",
           v.address AS "vendorAddress", v.mobile AS "vendorMobile",
           u.name AS "createdByName",
           COALESCE((SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id), 0)::int AS "itemCount",
           COALESCE((SELECT SUM(gi.received_qty) FROM grn_items gi WHERE gi.grn_id = g.id), 0)::numeric(12,3) AS "totalQty",
           COALESCE(
             (SELECT json_agg(
               json_build_object(
                 'id', gi.id,
                 'material_id', gi.material_id,
                 'materialCode', m.code,
                 'materialName', m.name,
                 'uom', gi.uom,
                 'hsnCode', m.hsn_code,
                 'categoryName', mc.name,
                 'received_qty', gi.received_qty,
                 'unit_price', gi.unit_price,
                 'discount_pct', gi.discount_pct,
                 'taxable_amount', gi.taxable_amount,
                 'gst_pct', gi.gst_pct,
                 'cgst_amount', gi.cgst_amount,
                 'sgst_amount', gi.sgst_amount,
                 'igst_amount', gi.igst_amount,
                 'total_amount', gi.total_amount,
                 'batch_number', gi.batch_number,
                 'bin_location', gi.bin_location,
                 'remarks', gi.remarks
               ) ORDER BY gi.id ASC
             ) FROM grn_items gi
               JOIN materials m ON gi.material_id = m.id
               LEFT JOIN material_categories mc ON m.category_id = mc.id
               WHERE gi.grn_id = g.id
             ), '[]'::json
           ) AS items
    FROM grn g
    LEFT JOIN vendors v ON g.vendor_id = v.id
    LEFT JOIN users u ON g.received_by = u.id
    WHERE ${whereClause}
    ORDER BY g.id DESC
    LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}
  `, [...vals, parseInt(limit), offset]);

  const countRes = await pool.query(`
    SELECT COUNT(*) as total_count,
           COALESCE(SUM((SELECT SUM(gi.received_qty) FROM grn_items gi WHERE gi.grn_id = g.id)), 0) as total_qty,
           COALESCE(SUM(COALESCE(g.total_taxable, (SELECT SUM(taxable_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0)), 0) as total_taxable,
           COALESCE(SUM(COALESCE(g.total_gst, (SELECT SUM(cgst_amount + sgst_amount + igst_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0)), 0) as total_gst,
           COALESCE(SUM(COALESCE(g.grand_total, (SELECT SUM(total_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0)), 0) as total_value,
           COALESCE(SUM((SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id)), 0)::int as total_items
    FROM grn g
    LEFT JOIN vendors v ON g.vendor_id = v.id
    WHERE ${whereClause}
  `, vals);

  const todayRes = await pool.query(`
    SELECT COUNT(*) as today_count,
           COALESCE(SUM((SELECT SUM(gi.received_qty) FROM grn_items gi WHERE gi.grn_id = g.id)), 0) as today_qty,
           COALESCE(SUM(COALESCE(g.grand_total, (SELECT SUM(total_amount) FROM grn_items gi WHERE gi.grn_id = g.id), 0)), 0) as today_value
    FROM grn g
    WHERE g.date = CURRENT_DATE
  `);

  res.json({
    success: true,
    view: 'master',
    data: rows,
    total: parseInt(countRes.rows[0].total_count || 0),
    summary: {
      totalCount: parseInt(countRes.rows[0].total_count || 0),
      totalItems: parseInt(countRes.rows[0].total_items || 0),
      totalQty: parseFloat(countRes.rows[0].total_qty || 0),
      totalTaxable: parseFloat(countRes.rows[0].total_taxable || 0),
      totalGst: parseFloat(countRes.rows[0].total_gst || 0),
      totalValue: parseFloat(countRes.rows[0].total_value || 0),
      todayCount: parseInt(todayRes.rows[0]?.today_count || 0),
      todayQty: parseFloat(todayRes.rows[0]?.today_qty || 0),
      todayValue: parseFloat(todayRes.rows[0]?.today_value || 0),
    }
  });
}));

// Helper to sync PO received quantities and status atomically
async function syncPoReceived(client, poRef, materialId, qtyDelta) {
  if (!poRef || !materialId || !qtyDelta) return null;
  const isNum = /^\d+$/.test(String(poRef));
  const { rows: [po] } = await client.query(
    isNum ? `SELECT id, po_number, status FROM purchase_orders WHERE id = $1` : `SELECT id, po_number, status FROM purchase_orders WHERE po_number = $1`,
    [isNum ? parseInt(poRef) : String(poRef)]
  );
  if (!po) return null;

  // Update po_items received_qty
  await client.query(
    `UPDATE po_items SET received_qty = GREATEST(0, COALESCE(received_qty, 0) + $1)
     WHERE po_id = $2 AND material_id = $3`,
    [qtyDelta, po.id, materialId]
  );

  // Recalculate PO overall status
  const { rows: itemRows } = await client.query(
    `SELECT qty, received_qty FROM po_items WHERE po_id = $1`, [po.id]
  );
  if (itemRows.length > 0) {
    const fullyReceived = itemRows.every(r => Number(r.received_qty || 0) >= Number(r.qty));
    const partiallyReceived = itemRows.some(r => Number(r.received_qty || 0) > 0);
    const newStatus = fullyReceived ? 'Received' : (partiallyReceived ? 'Partial' : 'Approved');
    if (po.status !== 'Draft' && po.status !== 'Cancelled') {
      await client.query(`UPDATE purchase_orders SET status = $1 WHERE id = $2`, [newStatus, po.id]);
    }
  }
  return po.id;
}

// POST /api/store/inward — Fast Inward (GRN / Vendor / Return) with Unified Single-GRN Intake & Batch Support
router.post('/inward', requireAuth, requireStore, ar(async (req, res) => {
  const { material_id, in_qty, unit_price, inward_type = 'grn', reference_type, reference_id,
          department_id, vendor_name, vendor_id, bin_location, batch_number, quality_status = 'Accepted', remarks, items,
          gate_pass_id, grn_id, challan_number, invoice_number, vehicle_number } = req.body;

  // Prepare normalized item list (support both single-item and multi-item batch payloads)
  let itemList = [];
  if (Array.isArray(items) && items.length > 0) {
    itemList = items.filter(it => it.material_id && Number(it.in_qty) > 0);
  } else if (material_id && Number(in_qty) > 0) {
    itemList = [{
      material_id,
      in_qty: parseFloat(in_qty),
      unit_price: unit_price !== undefined && unit_price !== '' ? parseFloat(unit_price) : undefined,
      bin_location,
      batch_number,
      quality_status: quality_status || 'Accepted',
      remarks
    }];
  }

  if (!itemList.length) {
    return res.status(400).json({ success: false, message: 'Valid material and quantity (> 0) required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let deptName = '';
    if (department_id) {
      const { rows: [dept] } = await client.query('SELECT name FROM departments WHERE id = $1', [department_id]);
      if (dept) deptName = dept.name;
    }

    // Resolve PO ID if reference is a PO
    let resolvedPoId = null;
    let poVendorId = null;
    let poVendorName = null;
    if (reference_type === 'PO' && reference_id) {
      const isNum = /^\d+$/.test(String(reference_id));
      const { rows: [po] } = await client.query(
        isNum ? `SELECT po.id, po.vendor_id, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = $1`
              : `SELECT po.id, po.vendor_id, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.po_number = $1`,
        [isNum ? parseInt(reference_id) : String(reference_id)]
      );
      if (po) {
        resolvedPoId = po.id;
        poVendorId = po.vendor_id;
        poVendorName = po.vendor_name;
      }
    }

    const refIdNum = resolvedPoId || (/^\d+$/.test(String(reference_id)) ? parseInt(reference_id) : null);
    const vendorIdNum = /^\d+$/.test(String(vendor_id)) ? parseInt(vendor_id) : (poVendorId || null);
    const resolvedVendorName = vendor_name || poVendorName || '';
    const gatePassIdNum = /^\d+$/.test(String(gate_pass_id)) ? parseInt(gate_pass_id) : null;
    const resolvedInvoice = invoice_number || (reference_type === 'INV' ? String(reference_id) : null);
    const resolvedChallan = challan_number || (reference_type === 'DC' ? String(reference_id) : null);
    const results = [];

    // Unified Single-GRN Intake: Reuse existing active GRN for this PO/Invoice/Challan/GatePass/grn_number or create 1 new GRN head
    let createdGrnId = null;
    let grnNum = null;
    if (inward_type === 'grn' || reference_type === 'PO' || reference_type === 'INV' || reference_type === 'DC' || gatePassIdNum || grn_id || req.body.grn_number || req.body.grnNum) {
      
      // 1. Check explicit grn_id
      if (grn_id) {
        const { rows: [existG] } = await client.query('SELECT id, grn_number FROM grn WHERE id = $1', [grn_id]);
        if (existG) {
          createdGrnId = existG.id;
          grnNum = existG.grn_number;
        }
      }

      // 2. Check explicit grn_number or GRN reference
      const targetGrnNum = req.body.grn_number || req.body.grnNum || (reference_type === 'GRN' || String(reference_id || '').toUpperCase().startsWith('GRN-') ? String(reference_id).trim() : null);
      if (!createdGrnId && targetGrnNum) {
        const { rows: [existGNum] } = await client.query('SELECT id, grn_number FROM grn WHERE grn_number = $1 OR grn_number ILIKE $1', [targetGrnNum]);
        if (existGNum) {
          createdGrnId = existGNum.id;
          grnNum = existGNum.grn_number;
        }
      }

      // 3. Check if open GRN already created today for this PO
      if (!createdGrnId && resolvedPoId) {
        const { rows: [samePoGrn] } = await client.query(
          `SELECT id, grn_number FROM grn 
           WHERE po_id = $1 AND date >= CURRENT_DATE - INTERVAL '1 day' AND status IN ('Draft', 'Received') 
           ORDER BY id DESC LIMIT 1`,
          [resolvedPoId]
        );
        if (samePoGrn) {
          createdGrnId = samePoGrn.id;
          grnNum = samePoGrn.grn_number;
        }
      }

      // 4. Check if open GRN already created today for this Gate Pass
      if (!createdGrnId && gatePassIdNum) {
        const { rows: [sameGpGrn] } = await client.query(
          `SELECT id, grn_number FROM grn 
           WHERE gate_pass_id = $1 AND date >= CURRENT_DATE - INTERVAL '1 day' AND status IN ('Draft', 'Received') 
           ORDER BY id DESC LIMIT 1`,
          [gatePassIdNum]
        );
        if (sameGpGrn) {
          createdGrnId = sameGpGrn.id;
          grnNum = sameGpGrn.grn_number;
        }
      }

      // 5. Check if open GRN already created today for this Invoice or Challan from same Vendor
      if (!createdGrnId && (resolvedInvoice || resolvedChallan)) {
        let matchSql = `SELECT id, grn_number FROM grn WHERE date >= CURRENT_DATE - INTERVAL '1 day' AND status IN ('Draft', 'Received') `;
        const matchParams = [];
        if (vendorIdNum) {
          matchParams.push(vendorIdNum);
          matchSql += `AND vendor_id = $${matchParams.length} `;
        }
        if (resolvedInvoice && resolvedChallan) {
          matchParams.push(resolvedInvoice, resolvedChallan);
          matchSql += `AND (invoice_number = $${matchParams.length - 1} OR challan_number = $${matchParams.length}) `;
        } else if (resolvedInvoice) {
          matchParams.push(resolvedInvoice);
          matchSql += `AND invoice_number = $${matchParams.length} `;
        } else if (resolvedChallan) {
          matchParams.push(resolvedChallan);
          matchSql += `AND challan_number = $${matchParams.length} `;
        }
        matchSql += `ORDER BY id DESC LIMIT 1`;
        const { rows: [sameDocGrn] } = await client.query(matchSql, matchParams);
        if (sameDocGrn) {
          createdGrnId = sameDocGrn.id;
          grnNum = sameDocGrn.grn_number;
        }
      }

      // 6. If no existing active GRN found, create exactly ONE formal GRN record for the entire item batch
      if (!createdGrnId) {
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`grn-${stamp}`]);
        const { rows: seqRows } = await client.query(`SELECT LPAD((COUNT(*)+1)::text, 4, '0') as seq FROM grn WHERE grn_number LIKE $1`, [`GRN-${stamp}-%`]);
        grnNum = `GRN-${stamp}-${seqRows[0].seq}`;

        const { rows: [grnHead] } = await client.query(
          `INSERT INTO grn (grn_number, date, vendor_id, po_id, gate_pass_id, vehicle_number, challan_number, invoice_number, received_by, status, remarks)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, 'Received', $9) RETURNING id`,
          [grnNum, vendorIdNum, resolvedPoId || null, gatePassIdNum || null, vehicle_number || null, resolvedChallan || null, resolvedInvoice || null, req.user.id, remarks || null]
        );
        createdGrnId = grnHead.id;
      }

      // Close the Inward Gate Pass if linked
      if (gatePassIdNum) {
        await client.query(`UPDATE gate_passes SET status = 'Closed' WHERE id = $1`, [gatePassIdNum]);
      }
    }

    for (const it of itemList) {
      const { rows: [mat] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [it.material_id]);
      if (!mat) throw new Error(`Material ID ${it.material_id} not found`);

      const qty = parseFloat(it.in_qty);
      const price = it.unit_price !== undefined && it.unit_price !== '' && !isNaN(it.unit_price)
        ? parseFloat(it.unit_price)
        : parseFloat(mat.unit_price || 0);
      const newStock = parseFloat(mat.current_stock || 0) + qty;
      const totalVal = qty * price;
      const finalBin = it.bin_location || bin_location || mat.bin_location;
      const itemBatch = it.batch_number || batch_number || null;
      const itemQC = it.quality_status || quality_status || 'Accepted';
      const itemRemarks = it.remarks || remarks || '';

      await client.query(`
        UPDATE materials
        SET current_stock = $1,
            bin_location = COALESCE($2, bin_location),
            unit_price = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE unit_price END
        WHERE id = $4
      `, [newStock, finalBin, price, mat.id]);

      const remarkFull = [
        inward_type === 'return' ? (deptName ? `[Dept Return - ${deptName}]` : '[Dept Return]') : (grnNum ? `[GRN ${grnNum}]` : '[GRN]'),
        reference_id ? `Ref: ${reference_id}` : null,
        resolvedVendorName ? `Party: ${resolvedVendorName}` : null,
        itemQC ? `QC: ${itemQC}` : null,
        itemRemarks
      ].filter(Boolean).join(' | ');

      const { rows: [ledger] } = await client.query(`
        INSERT INTO stock_ledger (
          material_id, date, transaction_type, reference_type, reference_id,
          in_qty, out_qty, balance, unit_price, value,
          batch_number, bin_location, remarks, created_by, vendor_id
        ) VALUES (
          $1, CURRENT_DATE, $2, $3, $4,
          $5, 0, $6, $7, $8,
          $9, $10, $11, $12, $13
        ) RETURNING *
      `, [
        mat.id, inward_type === 'return' ? 'return' : 'grn', createdGrnId ? 'GRN' : (reference_type || 'GRN'), createdGrnId || refIdNum,
        qty, newStock, price, totalVal,
        itemBatch, finalBin || null, remarkFull, req.user.id, vendorIdNum
      ]);

      // If GRN was created, attach grn_items under the single GRN
      if (createdGrnId) {
        const discPct = it.discount_pct !== undefined ? Math.max(0, Math.min(100, parseFloat(it.discount_pct))) : 0;
        const otherChg = it.other_charges !== undefined ? parseFloat(it.other_charges) : 0;
        const gstPct = it.gst_pct !== undefined ? parseFloat(it.gst_pct) : 18;
        const itemTaxType = (it.tax_type || req.body.tax_type || 'intra').toLowerCase();

        const gross = qty * price;
        const discAmt = gross * (discPct / 100);
        const discBase = Math.max(0, gross - discAmt);
        const taxableVal = Math.max(0, discBase + otherChg);

        let cgstPct = 0, sgstPct = 0, igstPct = 0;
        let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;

        if (itemTaxType === 'inter' || itemTaxType === 'state' || itemTaxType === 'igst') {
          igstPct = gstPct;
          igstAmt = taxableVal * (igstPct / 100);
        } else {
          cgstPct = gstPct / 2;
          sgstPct = gstPct / 2;
          cgstAmt = taxableVal * (cgstPct / 100);
          sgstAmt = taxableVal * (sgstPct / 100);
        }
        const lineTot = taxableVal + (cgstAmt + sgstAmt + igstAmt);

        await client.query(
          `INSERT INTO grn_items (
             grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price,
             discount_pct, discount_amount, other_charges, taxable_amount, gst_pct, tax_type,
             cgst_pct, sgst_pct, igst_pct, cgst_amount, sgst_amount, igst_amount, total_amount,
             bin_location, batch_number, remarks
           )
           VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
          [createdGrnId, mat.id, qty, qty, qty, mat.uom || 'Nos', price,
           discPct, discAmt, otherChg, taxableVal, gstPct, itemTaxType,
           cgstPct, sgstPct, igstPct, cgstAmt, sgstAmt, igstAmt, lineTot,
           finalBin || null, itemBatch || null, itemRemarks || null]
        );
      }

      // Digital Twin & Serialized Assets: Auto-register unique serial numbers for Machine Clothing / Serialized Items
      const isClothing = mat.is_serialized || (mat.category_id && (await client.query(`SELECT name FROM material_categories WHERE id=$1`, [mat.category_id])).rows[0]?.name?.toLowerCase().includes('clothing'));
      if (isClothing && qty > 0) {
        let rawSerials = it.serial_number || it.serial_numbers || itemBatch || '';
        let snList = [];
        if (Array.isArray(rawSerials)) {
          snList = rawSerials.map(s => String(s).trim()).filter(Boolean);
        } else if (typeof rawSerials === 'string' && rawSerials.trim()) {
          snList = rawSerials.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        }

        const countToCreate = Math.floor(qty);
        while (snList.length < countToCreate) {
          const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const rand = Math.floor(1000 + Math.random() * 9000);
          snList.push(`${mat.code || 'PMC'}-${stamp}-${rand}`);
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
              assetNumber, mat.id, sn, itemBatch || null, createdGrnId || null, vendorIdNum || null,
              price, mat.expected_lifespan_days || 90
            ]
          );
        }
      }

      // Sync PO received quantity if applicable
      if (reference_type === 'PO' && reference_id) {
        await syncPoReceived(client, reference_id, mat.id, qty);
      }

      await auditLog(client, {
        userId: req.user.id,
        action: 'store.inward',
        module: 'store',
        recordId: ledger.id,
        newData: { material_id: mat.id, qty, price, newStock, inward_type, reference_id, grn_number: grnNum },
        ip: req.ip
      });

      publish(TOPICS.EVENTS_ALL, `inward-${ledger.id}`, { event: 'store.inward.created', id: ledger.id, materialId: mat.id, qty, newStock, userId: req.user.id });
      results.push({ ...ledger, grnNumber: grnNum, grnId: createdGrnId });
    }

    if (createdGrnId) {
      await client.query(
        `UPDATE grn
         SET total_value = (SELECT COALESCE(SUM(taxable_amount), 0) FROM grn_items WHERE grn_id = $1),
             discount_value = (SELECT COALESCE(SUM(discount_amount), 0) FROM grn_items WHERE grn_id = $1),
             other_charges = (SELECT COALESCE(SUM(other_charges), 0) FROM grn_items WHERE grn_id = $1),
             cgst_value = (SELECT COALESCE(SUM(cgst_amount), 0) FROM grn_items WHERE grn_id = $1),
             sgst_value = (SELECT COALESCE(SUM(sgst_amount), 0) FROM grn_items WHERE grn_id = $1),
             igst_value = (SELECT COALESCE(SUM(igst_amount), 0) FROM grn_items WHERE grn_id = $1),
             gst_value = (SELECT COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) FROM grn_items WHERE grn_id = $1),
             grand_total = (SELECT COALESCE(SUM(total_amount), 0) FROM grn_items WHERE grn_id = $1)
         WHERE id = $1`,
        [createdGrnId]
      );
    }

    await client.query('COMMIT');

    const msg = itemList.length === 1
      ? `Inward recorded successfully under GRN ${grnNum || 'GRN'}. Stock updated.`
      : `Batch inward successfully recorded under single GRN ${grnNum || 'GRN'} (${itemList.length} items received).`;

    res.json({ success: true, message: msg, data: results.length === 1 ? results[0] : results, grnNumber: grnNum, grnId: createdGrnId });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// ── OUTWARD DESK ────────────────────────────────────────────────────────────
// GET /api/store/vendors/:vendorId/grn-materials — Fetch distinct materials received from a vendor
router.get('/vendors/:vendorId/grn-materials', requireAuth, ar(async (req, res) => {
  const vendorId = parseInt(req.params.vendorId);
  if (!vendorId) {
    return res.status(400).json({ success: false, message: 'Valid vendorId required' });
  }

  const { rows } = await pool.query(`
    SELECT DISTINCT ON (gi.material_id, g.id)
      gi.material_id AS "material_id",
      m.name AS "materialName",
      m.code AS "materialCode",
      m.uom,
      m.hsn_code AS "hsnCode",
      COALESCE(m.current_stock, 0) AS "currentStock",
      gi.unit_price AS "unitPrice",
      gi.received_qty AS "receivedQty",
      gi.batch_number AS "batchNumber",
      COALESCE(gi.gst_pct, 18) AS "gstPct",
      gi.tax_type AS "taxType",
      gi.cgst_pct AS "cgstPct",
      gi.sgst_pct AS "sgstPct",
      gi.igst_pct AS "igstPct",
      g.id AS "grnId",
      g.grn_number AS "grnNumber",
      g.date AS "grnDate",
      g.invoice_number AS "invoiceNumber"
    FROM grn_items gi
    JOIN grn g ON gi.grn_id = g.id
    JOIN materials m ON gi.material_id = m.id
    WHERE g.vendor_id = $1
    ORDER BY gi.material_id, g.id, g.date DESC
  `, [vendorId]);

  res.json({ success: true, data: rows });
}));

// GET /api/store/outward
router.get('/outward', requireAuth, ar(async (req, res) => {
  const { from, to, store_type, department_id, search, outward_type, limit = 100, page = 1 } = req.query;
  const where = ["sl.transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer', 'job_work')"];
  const vals = [];

  if (from) { vals.push(from); where.push(`sl.date >= $${vals.length}`); }
  if (to)   { vals.push(to);   where.push(`sl.date <= $${vals.length}`); }
  if (outward_type) {
    if (outward_type === 'job_work') {
      vals.push('job_work');
      where.push(`sl.transaction_type = $${vals.length}`);
    } else if (outward_type === 'return_to_vendor') {
      vals.push('return_to_vendor');
      where.push(`sl.transaction_type = $${vals.length}`);
    } else if (outward_type === 'transfer' || outward_type === 'inter_store_transfer') {
      vals.push('transfer');
      where.push(`sl.transaction_type = $${vals.length}`);
    } else if (outward_type === 'issue') {
      vals.push('issue');
      where.push(`sl.transaction_type = $${vals.length}`);
    }
  }
  if (department_id) {
    vals.push(parseInt(department_id));
    where.push(`m.section_id = $${vals.length}`);
  }
  if (store_type && store_type !== 'all') {
    if (store_type === 'Engineering') {
      where.push(`(mc.type = 'Spare' OR mc.name ILIKE '%Mechanical%' OR mc.name ILIKE '%Electrical%' OR mc.name ILIKE '%Civil%')`);
    } else if (store_type === 'Raw Material') {
      where.push(`(mc.type = 'Raw Material' OR mc.name IN ('Waste Paper', 'Imported Pulp', 'Chemicals', 'Dyes'))`);
    } else if (store_type === 'General') {
      where.push(`(mc.type = 'Consumable' OR mc.name IN ('General', 'Stationary', 'Clothing', 'Packing'))`);
    }
  }
  if (search) {
    vals.push(`%${search}%`);
    where.push(`(m.name ILIKE $${vals.length} OR m.code ILIKE $${vals.length} OR sl.remarks ILIKE $${vals.length} OR sl.batch_number ILIKE $${vals.length} OR v.name ILIKE $${vals.length})`);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const whereClause = where.join(' AND ');

  const { rows } = await pool.query(`
    SELECT sl.id, sl.date, sl.material_id, sl.transaction_type, sl.reference_type, sl.reference_id,
           sl.vendor_id, sl.out_qty, sl.balance, sl.unit_price, sl.value, sl.batch_number, sl.bin_location,
           sl.remarks, sl.created_at,
           m.name AS "materialName", m.code AS "materialCode", m.uom,
           mc.name AS "categoryName",
           u.name AS "createdByName",
           v.name AS "vendorName", v.code AS "vendorCode"
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN users u ON sl.created_by = u.id
    LEFT JOIN vendors v ON sl.vendor_id = v.id
    WHERE ${whereClause}
    ORDER BY sl.id DESC
    LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}
  `, [...vals, parseInt(limit), offset]);

  const countRes = await pool.query(`
    SELECT COUNT(*) as total_count, COALESCE(SUM(sl.out_qty), 0) as total_qty, COALESCE(SUM(sl.value), 0) as total_value
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN vendors v ON sl.vendor_id = v.id
    WHERE ${whereClause}
  `, vals);

  const todayRes = await pool.query(`
    SELECT COUNT(*) as today_count, COALESCE(SUM(sl.out_qty), 0) as today_qty, COALESCE(SUM(sl.value), 0) as today_value
    FROM stock_ledger sl
    WHERE sl.transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer', 'job_work') AND sl.date = CURRENT_DATE
  `);

  res.json({
    success: true,
    data: rows,
    total: parseInt(countRes.rows[0].total_count),
    summary: {
      totalCount: parseInt(countRes.rows[0].total_count),
      totalQty: parseFloat(countRes.rows[0].total_qty),
      totalValue: parseFloat(countRes.rows[0].total_value),
      todayCount: parseInt(todayRes.rows[0].today_count),
      todayQty: parseFloat(todayRes.rows[0].today_qty),
      todayValue: parseFloat(todayRes.rows[0].today_value),
    }
  });
}));

// POST /api/store/outward — Fast Outward Issue: 1. Job Work | 2. Return to Party | 3. Inter Store Transfer | 4. Dept Issue (Multi-Item Batch Support with Sub Amount & GST Tax Calculation)
router.post('/outward', requireAuth, requireStore, ar(async (req, res) => {
  const {
    material_id, out_qty, unit_price, gst_pct, department_id, machine_id, position_id, section_id,
    vendor_id, outward_type = 'issue', issued_to, purpose, serial_number, batch_number,
    reference_type, reference_id, remarks, date, grn_id, items
  } = req.body;

  let lineItems = [];
  if (Array.isArray(items) && items.length > 0) {
    lineItems = items.filter(it => it && it.material_id && Number(it.out_qty) > 0);
  } else if (material_id && Number(out_qty) > 0) {
    lineItems = [{
      material_id,
      out_qty,
      unit_price,
      gst_pct: gst_pct !== undefined ? gst_pct : 18,
      machine_id: machine_id || null,
      position_id: position_id || null,
      section_id: section_id || null,
      serial_number: serial_number || null,
      batch_number: batch_number || null,
      remarks: remarks || '',
      grn_id: grn_id || null
    }];
  }

  if (lineItems.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one valid material line item with quantity (> 0) is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock and validate stock for all items
    const validatedItems = [];
    for (const item of lineItems) {
      const { rows: [mat] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [item.material_id]);
      if (!mat) throw new Error(`Material with ID ${item.material_id} not found`);

      const qty = parseFloat(item.out_qty);
      const curStock = parseFloat(mat.current_stock || 0);

      if (curStock < qty) {
        throw new Error(`Insufficient stock for "${mat.name}". Available: ${curStock} ${mat.uom}, Requested: ${qty} ${mat.uom}`);
      }

      const price = (item.unit_price !== undefined && item.unit_price !== null && item.unit_price !== '' && !isNaN(parseFloat(item.unit_price)))
        ? parseFloat(item.unit_price)
        : parseFloat(mat.unit_price || 0);

      const taxableAmount = qty * price;
      const itemGstPct = (item.gst_pct !== undefined && item.gst_pct !== null && item.gst_pct !== '' && !isNaN(parseFloat(item.gst_pct)))
        ? parseFloat(item.gst_pct)
        : 18.0;
      const taxAmount = (taxableAmount * itemGstPct) / 100.0;
      const totalAmount = taxableAmount + taxAmount;

      validatedItems.push({
        ...item,
        mat,
        curStock,
        qty,
        price,
        gstPct: itemGstPct,
        taxableAmount,
        taxAmount,
        totalAmount,
        totalVal: taxableAmount
      });
    }

    // 2. Fetch context metadata (Department, Vendor)
    let deptName = '';
    if (department_id) {
      const { rows: [dept] } = await client.query('SELECT name FROM departments WHERE id = $1', [department_id]);
      if (dept) deptName = dept.name;
    }

    let vendorName = '';
    const vId = vendor_id ? parseInt(vendor_id) : null;
    if (vId) {
      const { rows: [ven] } = await client.query('SELECT name, code, gstin, state FROM vendors WHERE id = $1', [vId]);
      if (ven) vendorName = ven.name;
    }

    // 3. Determine transaction type & reference defaults
    let txnType = 'issue';
    let defaultRefType = 'ISSUE';
    let prefixTag = '[Store Issue]';

    if (outward_type === 'job_work') {
      txnType = 'job_work';
      defaultRefType = 'JOB_WORK';
      prefixTag = '[Job Work]';
    } else if (outward_type === 'return_to_vendor') {
      txnType = 'return_to_vendor';
      defaultRefType = 'RTV';
      prefixTag = '[Return to Party]';
    } else if (outward_type === 'inter_store_transfer' || outward_type === 'transfer') {
      txnType = 'transfer';
      defaultRefType = 'STO';
      prefixTag = '[Inter Store Transfer]';
    }

    let generatedRef = reference_id || '';
    let createdGatePass = null;

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const matSummaryText = validatedItems.map(vi => `${vi.qty} ${vi.mat.uom} of ${vi.mat.name} (${vi.mat.code})`).join(', ');

    const totalSubAmount = validatedItems.reduce((sum, it) => sum + it.taxableAmount, 0);
    const totalTaxAmount = validatedItems.reduce((sum, it) => sum + it.taxAmount, 0);
    const totalDebitNoteAmount = totalSubAmount + totalTaxAmount;

    // 4. Automatic Gate Pass provisioning for Job Work & RTV (Bundled for batch with Sub & Tax Breakdown)
    if (outward_type === 'job_work') {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`gp-jw-${stamp}`]);
      const { rows: [seq] } = await client.query(`SELECT COUNT(*)+1 AS n FROM gate_passes WHERE created_at::date = CURRENT_DATE`);
      const gpNum = `GP-JW-${stamp}-${String(seq.n).padStart(4, '0')}`;

      const { rows: [gp] } = await client.query(`
        INSERT INTO gate_passes (
          gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
          material_description, from_party, to_party, out_time, security_guard_id, remarks,
          vendor_id, status
        ) VALUES (
          $1, 'RETURNABLE', 'Commercial Vehicle', 'To be logged at gate', 'Authorized Driver', $2,
          $3, 'MK Paper Mill Main Store', $4, NOW(), $5, $6,
          $7, 'Open'
        ) RETURNING id, gp_number
      `, [
        gpNum,
        purpose || 'Material Outward for Job Work / Outside Repair',
        `Job Work (${validatedItems.length} items · Val: ₹${totalSubAmount.toFixed(2)}): ${matSummaryText}`,
        vendorName || 'Outside Job Worker',
        req.user.id,
        remarks || `Job work outward dispatched by ${req.user.name || 'Store'}`,
        vId
      ]);
      createdGatePass = gp;
      if (!generatedRef) generatedRef = gp.gp_number;
    } else if (outward_type === 'return_to_vendor') {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`gp-rtv-${stamp}`]);
      const { rows: [seq] } = await client.query(`SELECT COUNT(*)+1 AS n FROM gate_passes WHERE created_at::date = CURRENT_DATE`);
      const gpNum = `GP-RTV-${stamp}-${String(seq.n).padStart(4, '0')}`;

      const { rows: [gp] } = await client.query(`
        INSERT INTO gate_passes (
          gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
          material_description, from_party, to_party, out_time, security_guard_id, remarks,
          vendor_id, status
        ) VALUES (
          $1, 'RTV', 'Commercial Vehicle', 'To be logged at gate', 'Authorized Driver', $2,
          $3, 'MK Paper Mill', $4, NOW(), $5, $6,
          $7, 'Closed'
        ) RETURNING id, gp_number
      `, [
        gpNum,
        purpose || 'Return to Vendor (RTV)',
        `RTV Return (${validatedItems.length} items | Sub: ₹${totalSubAmount.toFixed(2)} + Tax: ₹${totalTaxAmount.toFixed(2)} = Debit: ₹${totalDebitNoteAmount.toFixed(2)}): ${matSummaryText}`,
        vendorName || 'Supplier / Vendor',
        req.user.id,
        remarks || `Return to party processed with Debit Note by ${req.user.name || 'Store'}`,
        vId
      ]);
      createdGatePass = gp;
      if (!generatedRef) generatedRef = gp.gp_number;
    } else if (outward_type === 'inter_store_transfer' || outward_type === 'transfer') {
      if (!generatedRef) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sto-${stamp}`]);
        const { rows: [seq] } = await client.query(`SELECT COUNT(*)+1 AS n FROM store_transfers WHERE created_at::date = CURRENT_DATE`);
        generatedRef = `STO-${stamp}-${String(seq.n).padStart(4, '0')}`;
      }
    }

    const refIdNum = /^\d+$/.test(String(generatedRef)) ? parseInt(generatedRef) : null;
    const txnDate = date ? new Date(date) : new Date();
    const createdLedgerRows = [];

    // 5. Deduct stock & create ledger records for each item (recording Sub Amount and Tax Amount)
    for (const vi of validatedItems) {
      const newStock = vi.curStock - vi.qty;
      await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStock, vi.material_id]);

      let itemMachineName = '';
      const mId = vi.machine_id || machine_id || null;
      if (mId) {
        const { rows: [mach] } = await client.query('SELECT name, code FROM machines WHERE id = $1', [mId]);
        if (mach) itemMachineName = mach.name || mach.code;
      }

      const fiscalDetail = outward_type === 'return_to_vendor'
        ? `Sub: ₹${vi.taxableAmount.toFixed(2)} | GST (${vi.gstPct}%): ₹${vi.taxAmount.toFixed(2)} | Debit Total: ₹${vi.totalAmount.toFixed(2)}`
        : null;

      const remarkFull = [
        prefixTag,
        vendorName ? `Party: ${vendorName}` : null,
        generatedRef && !refIdNum ? `Ref: ${generatedRef}` : null,
        fiscalDetail,
        deptName ? `Dept: ${deptName}` : null,
        itemMachineName ? `M/S: ${itemMachineName}` : null,
        issued_to ? `To: ${issued_to}` : null,
        purpose ? `Purpose: ${purpose}` : null,
        vi.remarks || remarks
      ].filter(Boolean).join(' | ');

      const { rows: [ledger] } = await client.query(`
        INSERT INTO stock_ledger (
          material_id, date, transaction_type, reference_type, reference_id,
          vendor_id, in_qty, out_qty, balance, unit_price, value,
          batch_number, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, 0, $7, $8, $9, $10,
          $11, $12, $13
        ) RETURNING *
      `, [
        vi.material_id, txnDate, txnType,
        reference_type || defaultRefType, refIdNum,
        vId, vi.qty, newStock, vi.price, vi.totalVal,
        vi.batch_number || vi.serial_number || batch_number || serial_number || null,
        remarkFull, req.user.id
      ]);

      createdLedgerRows.push({
        ...ledger,
        materialName: vi.mat.name,
        materialCode: vi.mat.code,
        uom: vi.mat.uom,
        newStock,
        taxableAmount: vi.taxableAmount,
        gstPct: vi.gstPct,
        taxAmount: vi.taxAmount,
        totalAmount: vi.totalAmount
      });

      // Serialized asset tracking if applicable
      if (vi.mat.is_serialized || mId || vi.serial_number) {
        const selectedSn = vi.serial_number || vi.batch_number || null;
        if (vi.position_id || position_id) {
          await client.query(
            `UPDATE installed_assets 
             SET status = 'retired', retired_at = NOW(), failure_reason = 'Replaced by clothing/asset ' || COALESCE($1, 'new issue')
             WHERE position_id = $2 AND status = 'active'`,
            [selectedSn, vi.position_id || position_id]
          );
        }

        let existingInStock = null;
        if (selectedSn) {
          const { rows: inStockRows } = await client.query(
            `SELECT id, asset_number FROM installed_assets 
             WHERE material_id = $1 AND LOWER(TRIM(serial_number)) = LOWER(TRIM($2)) AND status = 'In Stock' 
             ORDER BY id ASC LIMIT 1`,
            [vi.material_id, selectedSn]
          );
          if (inStockRows.length) existingInStock = inStockRows[0];
        }

        if (existingInStock) {
          await client.query(
            `UPDATE installed_assets
             SET status = 'active', machine_id = $1, position_id = $2, issued_by = $3, installed_at = NOW(), purchase_price = $4
             WHERE id = $5`,
            [mId, vi.position_id || position_id || null, req.user.id, vi.price, existingInStock.id]
          );
        }
      }

      await auditLog(client, {
        userId: req.user.id,
        action: 'store.outward',
        module: 'store',
        recordId: ledger.id,
        newData: {
          material_id: vi.material_id,
          qty: vi.qty,
          price: vi.price,
          taxableAmount: vi.taxableAmount,
          taxAmount: vi.taxAmount,
          totalAmount: vi.totalAmount,
          newStock,
          outward_type,
          vendor_id: vId,
          department_id,
          machine_id: mId,
          issued_to,
          ref: generatedRef
        },
        ip: req.ip
      });
    }

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `outward-batch`, { event: 'store.outward.batch_created', count: createdLedgerRows.length, outward_type, userId: req.user.id });

    const totalBatchQty = validatedItems.reduce((sum, it) => sum + it.qty, 0);
    const totalBatchVal = validatedItems.reduce((sum, it) => sum + it.totalVal, 0);

    res.json({
      success: true,
      message: outward_type === 'return_to_vendor'
        ? `RTV Debit Note processed (Sub Total: ₹${totalSubAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} + Tax: ₹${totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} = Debit Total: ₹${totalDebitNoteAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
        : `Outward recorded successfully (${createdLedgerRows.length} item(s) processed)`,
      data: createdLedgerRows,
      summary: {
        itemCount: createdLedgerRows.length,
        totalQty: totalBatchQty,
        totalValue: totalBatchVal,
        gatePass: createdGatePass,
        referenceId: generatedRef
      }
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// GET /api/store/grn/:id — Fetch Single Master GRN with all consolidated line items & vendor details
router.get('/grn/:id', requireAuth, ar(async (req, res) => {
  const grnId = String(req.params.id || '').trim();
  const where = `WHERE g.id::text = $1 OR g.grn_number = $1 OR g.grn_number ILIKE $1 OR g.invoice_number = $1 OR g.invoice_number ILIKE $1 OR g.challan_number = $1 OR g.challan_number ILIKE $1`;

  const { rows } = await pool.query(`
    SELECT g.*, g.grn_number AS "grnNumber",
           po.po_number AS "poNumber", po.date AS "poDate", po.grand_total AS "poGrandTotal",
           gp.gp_number AS "gatePassNumber",
           v.name AS "vendorName", v.code AS "vendorCode", v.gstin AS "vendorGstin",
           v.state AS "vendorState", v.city AS "vendorCity", v.address AS "vendorAddress",
           v.pincode AS "vendorPincode", v.mobile AS "vendorMobile", v.email AS "vendorEmail",
           v.pan AS "vendorPan",
           u.name AS "receivedByName"
    FROM grn g
    LEFT JOIN purchase_orders po ON po.id = g.po_id
    LEFT JOIN gate_passes gp ON gp.id = g.gate_pass_id
    LEFT JOIN vendors v ON v.id = g.vendor_id
    LEFT JOIN users u ON u.id = g.received_by
    ${where}
    ORDER BY g.id DESC
    LIMIT 1
  `, [grnId]);

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'GRN not found' });
  }

  const grn = rows[0];
  const { rows: items } = await pool.query(`
    SELECT gi.*,
           m.name AS "materialName", m.code AS "materialCode", m.uom AS "matUom",
           m.hsn_code AS "hsnCode", mc.name AS "categoryName",
           COALESCE(gi.gst_pct, 18) AS gst_pct,
           COALESCE(gi.taxable_amount, gi.received_qty * gi.unit_price) AS taxable_amount,
           COALESCE(gi.total_amount, gi.received_qty * gi.unit_price) AS total_amount
    FROM grn_items gi
    JOIN materials m ON m.id = gi.material_id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE gi.grn_id = $1
    ORDER BY gi.id ASC
  `, [grn.id]);

  res.json({ success: true, data: { ...grn, items } });
}));

// POST /api/store/grn/:id/items — Append new line item to existing GRN
router.post('/grn/:id/items', requireAuth, requireStore, ar(async (req, res) => {
  const grnId = req.params.id;
  const isNum = /^\d+$/.test(String(grnId));
  const { material_id, received_qty, unit_price, gst_pct = 18, tax_type = 'intra', discount_pct = 0, other_charges = 0, bin_location, batch_number, mrp, trade_price, remarks } = req.body;

  if (!material_id || !received_qty || Number(received_qty) <= 0) {
    return res.status(400).json({ success: false, message: 'Valid Material and Received Qty are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [grn] } = await client.query(
      isNum ? 'SELECT * FROM grn WHERE id = $1 FOR UPDATE' : 'SELECT * FROM grn WHERE grn_number = $1 FOR UPDATE',
      [isNum ? parseInt(grnId) : String(grnId)]
    );
    if (!grn) throw new Error('GRN not found');
    if (['Cancelled', 'Closed'].includes(grn.status) && (req.user?.role_level || 1) < 4) {
      throw new Error(`Cannot append items to a ${grn.status.toLowerCase()} GRN.`);
    }

    const { rows: [mat] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [material_id]);
    if (!mat) throw new Error('Material not found');

    const qty = parseFloat(received_qty);
    const price = unit_price !== undefined && unit_price !== '' ? parseFloat(unit_price) : parseFloat(mat.unit_price || 0);
    const discPct = Math.max(0, Math.min(100, parseFloat(discount_pct || 0)));
    const otherChg = parseFloat(other_charges || 0);
    const gPct = parseFloat(gst_pct || 18);
    const itemTaxType = (tax_type || 'intra').toLowerCase();

    const gross = qty * price;
    const discAmt = gross * (discPct / 100);
    const taxableVal = Math.max(0, gross - discAmt + otherChg);

    let cgstPct = 0, sgstPct = 0, igstPct = 0;
    let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;
    if (itemTaxType === 'inter' || itemTaxType === 'state' || itemTaxType === 'igst') {
      igstPct = gPct;
      igstAmt = taxableVal * (igstPct / 100);
    } else {
      cgstPct = gPct / 2;
      sgstPct = gPct / 2;
      cgstAmt = taxableVal * (cgstPct / 100);
      sgstAmt = taxableVal * (sgstPct / 100);
    }
    const lineTot = taxableVal + (cgstAmt + sgstAmt + igstAmt);

    const newStock = parseFloat(mat.current_stock || 0) + qty;
    const finalBin = bin_location || mat.bin_location || null;
    const finalBatch = batch_number || null;

    // 1. Insert grn_item
    const { rows: [insertedItem] } = await client.query(`
      INSERT INTO grn_items (
        grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty, uom, unit_price,
        discount_pct, discount_amount, other_charges, taxable_amount, gst_pct, tax_type,
        cgst_pct, sgst_pct, igst_pct, cgst_amount, sgst_amount, igst_amount, total_amount,
        bin_location, batch_number, remarks, mrp, trade_price
      ) VALUES (
        $1, $2, $3, $4, $5, 0, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25
      ) RETURNING *
    `, [
      grn.id, mat.id, qty, qty, qty, mat.uom || 'Nos', price,
      discPct, discAmt, otherChg, taxableVal, gPct, itemTaxType,
      cgstPct, sgstPct, igstPct, cgstAmt, sgstAmt, igstAmt, lineTot,
      finalBin, finalBatch, remarks || null, mrp ? parseFloat(mrp) : 0, trade_price ? parseFloat(trade_price) : price
    ]);

    // 2. Increment physical stock
    await client.query(`
      UPDATE materials
      SET current_stock = $1,
          bin_location = COALESCE($2, bin_location),
          unit_price = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE unit_price END
      WHERE id = $4
    `, [newStock, finalBin, price, mat.id]);

    // 3. Record in stock_ledger
    const remarkFull = `[GRN ${grn.grn_number}] Appended Line Item | ${remarks || ''}`.trim();
    await client.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        in_qty, out_qty, balance, unit_price, value,
        batch_number, bin_location, remarks, created_by, vendor_id
      ) VALUES (
        $1, CURRENT_DATE, 'grn', 'GRN', $2,
        $3, 0, $4, $5, $6,
        $7, $8, $9, $10, $11
      )
    `, [
      mat.id, grn.id, qty, newStock, price, taxableVal,
      finalBatch, finalBin, remarkFull, req.user.id, grn.vendor_id
    ]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Line item appended to GRN successfully', data: insertedItem });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}));

// PUT /api/store/issues/:id/receive — Department receiver signs & acknowledges physical store issue
router.put('/issues/:id/receive', requireAuth, ar(async (req, res) => {
  const { receiver_name, receiver_emp_code, receiver_signature_note, fitment_date, observations } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [issue] } = await client.query('SELECT * FROM store_issues WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!issue) throw new Error('Store issue record not found');

    const recName = receiver_name || req.user.name;
    const recEmpCode = receiver_emp_code || req.user.employee_code || null;

    await client.query(`
      UPDATE store_issues
      SET receiver_name = $1,
          receiver_emp_code = $2,
          receiver_signature_note = $3,
          receiver_signed_at = NOW(),
          receiver_signed_by = $4,
          status = 'Acknowledged'
      WHERE id = $5
    `, [recName, recEmpCode, receiver_signature_note || null, req.user.id, req.params.id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Receiver signature and acknowledgement recorded successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// PUT /api/store/indents/:id/receive — Department receiver signs & acknowledges store indent
router.put('/indents/:id/receive', requireAuth, ar(async (req, res) => {
  const { receiver_name, receiver_emp_code, receiver_signature_note, fitment_date, fitment_location, observations } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query('SELECT * FROM store_indents WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!ind) throw new Error('Store indent not found');

    const recName = receiver_name || req.user.name;
    const recEmpCode = receiver_emp_code || req.user.employee_code || null;

    await client.query(`
      UPDATE store_indents
      SET receiver_name = $1,
          receiver_emp_code = $2,
          receiver_signature_note = $3,
          receiver_signed_at = NOW(),
          receiver_signed_by = $4,
          fitment_date = $5,
          fitment_location = $6,
          observations = $7,
          status = 'Closed'
      WHERE id = $8
    `, [recName, recEmpCode, receiver_signature_note || null, req.user.id, fitment_date || null, fitment_location || null, observations || null, req.params.id]);

    await client.query(`
      INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
      VALUES ($1, 'Receiver Signed & Closed', $2, 'Closed', $3, $4, $5, $6)
    `, [ind.id, ind.status, req.user.id, recName, req.user.role || 'Receiver', receiver_signature_note || observations || 'Received in good condition']);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Receiver signed and indent closed successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// PUT /api/store/grn/:id — Update GRN header & line items price/quantities
router.put('/grn/:id', requireAuth, requireStore, ar(async (req, res) => {
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
    // GRN is normally 'Received' the moment it is created — that is the working state, not a
    // lock. Only a hard-terminal status (set once finance closes/cancels the receipt) blocks
    // further correction, mirroring the PO editable-unless-terminal pattern.
    if (['Cancelled', 'Closed'].includes(grn.status) && (req.user?.role_level || 1) < 4) {
      throw new Error(`Cannot edit a ${grn.status.toLowerCase()} GRN. It has been finalized.`);
    }

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
                unit_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE unit_price END,
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

// PUT /api/store/inward/:id — DML Update Inward GRN
router.put('/inward/:id', requireAuth, requireStore, ar(async (req, res) => {
  const { id } = req.params;
  const { in_qty, unit_price, reference_type, reference_id, vendor_name, bin_location, batch_number, quality_status, remarks, date } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [ledger] } = await client.query('SELECT * FROM stock_ledger WHERE id = $1 FOR UPDATE', [id]);
    if (!ledger) throw new Error('Inward record not found');
    if (!['grn', 'return', 'in'].includes(ledger.transaction_type)) {
      throw new Error('Record is not an inward transaction');
    }

    const { rows: [mat] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [ledger.material_id]);
    if (!mat) throw new Error('Material not found');

    const oldQty = parseFloat(ledger.in_qty || 0);
    const newQty = in_qty !== undefined ? parseFloat(in_qty) : oldQty;
    const oldPrice = parseFloat(ledger.unit_price || 0);
    const newPrice = unit_price !== undefined && unit_price !== '' ? parseFloat(unit_price) : oldPrice;
    const curStock = parseFloat(mat.current_stock || 0);

    const delta = newQty - oldQty;
    const newStock = curStock + delta;
    if (newStock < 0) {
      throw new Error(`Cannot update inward quantity: resulting material stock would be negative (${newStock} ${mat.uom})`);
    }

    const totalVal = newQty * newPrice;

    // Update material current_stock and unit_price
    await client.query(`
      UPDATE materials
      SET current_stock = $1,
          unit_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE unit_price END,
          bin_location = COALESCE($3, bin_location)
      WHERE id = $4
    `, [newStock, newPrice, bin_location || null, mat.id]);

    const refIdNum = reference_id !== undefined ? (/^\d+$/.test(String(reference_id)) ? parseInt(reference_id) : null) : ledger.reference_id;
    const remarkFull = remarks !== undefined ? remarks : ledger.remarks;

    const { rows: [updatedLedger] } = await client.query(`
      UPDATE stock_ledger
      SET in_qty = $1,
          balance = balance + $2,
          unit_price = $3,
          value = $4,
          reference_type = COALESCE($5, reference_type),
          reference_id = $6,
          batch_number = COALESCE($7, batch_number),
          bin_location = COALESCE($8, bin_location),
          remarks = $9,
          date = COALESCE($10::date, date)
      WHERE id = $11
      RETURNING *
    `, [
      newQty, delta, newPrice, totalVal, reference_type || null, refIdNum,
      batch_number || null, bin_location || null, remarkFull, date || null, id
    ]);

    // Sync PO received quantity if applicable
    const poRef = reference_id || ledger.reference_id;
    if ((reference_type === 'PO' || ledger.reference_type === 'PO') && poRef && delta !== 0) {
      await syncPoReceived(client, poRef, mat.id, delta);
    }

    // Sync linked grn_items if this inward is linked to a GRN
    if (reference_type === 'GRN' || ledger.reference_type === 'GRN' || reference_type === 'grn' || ledger.reference_type === 'grn') {
      const targetGrnId = refIdNum || ledger.reference_id;
      if (targetGrnId) {
        await client.query(`
          UPDATE grn_items
          SET unit_price = $1,
              received_qty = $2,
              accepted_qty = $2,
              bin_location = COALESCE($3, bin_location),
              batch_number = COALESCE($4, batch_number),
              remarks = COALESCE($5, remarks)
          WHERE (grn_id = $6 OR grn_id = (SELECT id FROM grn WHERE grn_number = $7 LIMIT 1))
            AND material_id = $8
        `, [newPrice, newQty, bin_location || null, batch_number || null, remarkFull || null, (/^\d+$/.test(String(targetGrnId)) ? parseInt(targetGrnId) : 0), String(targetGrnId), mat.id]);
      }
    }

    await auditLog(client, {
      userId: req.user.id,
      action: 'store.inward.update',
      module: 'store',
      recordId: id,
      oldData: { in_qty: oldQty, unit_price: oldPrice },
      newData: { in_qty: newQty, unit_price: newPrice, newStock },
      ip: req.ip
    });

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `inward-${id}`, { event: 'store.inward.updated', id, materialId: mat.id, newQty, newStock, userId: req.user.id });

    res.json({ success: true, message: 'Inward entry updated successfully', data: updatedLedger });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// DELETE /api/store/inward/:id — DML Delete / Void Inward GRN Line (Store Manager Only)
router.delete('/inward/:id', requireAuth, requireStoreManager, ar(async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [ledger] } = await client.query('SELECT * FROM stock_ledger WHERE id = $1 FOR UPDATE', [id]);
    if (!ledger) throw new Error('Inward record not found');
    if (!['grn', 'return', 'in'].includes(ledger.transaction_type)) {
      throw new Error('Record is not an inward transaction');
    }

    const { rows: [mat] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [ledger.material_id]);
    if (!mat) throw new Error('Material not found');

    const inQty = parseFloat(ledger.in_qty || 0);
    const curStock = parseFloat(mat.current_stock || 0);
    const newStock = curStock - inQty;

    if (newStock < 0) {
      throw new Error(`Cannot delete inward record: subsequent issues already consumed this stock (Remaining: ${curStock} ${mat.uom})`);
    }

    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStock, mat.id]);
    await client.query('DELETE FROM stock_ledger WHERE id = $1', [id]);

    // Reverse PO received quantity if applicable
    if (ledger.reference_type === 'PO' && ledger.reference_id && inQty > 0) {
      await syncPoReceived(client, ledger.reference_id, mat.id, -inQty);
    }

    await auditLog(client, {
      userId: req.user.id,
      action: 'store.inward.delete',
      module: 'store',
      recordId: id,
      oldData: { material_id: mat.id, in_qty: inQty, curStock },
      newData: { newStock },
      ip: req.ip
    });

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `inward-${id}`, { event: 'store.inward.deleted', id, materialId: mat.id, newStock, userId: req.user.id });

    res.json({ success: true, message: `Inward record removed. Restored balance: ${newStock} ${mat.uom}` });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// DELETE /api/store/grn/:id — Void / Delete entire Master GRN with atomic multi-item rollback (Store Manager Only)
router.delete('/grn/:id', requireAuth, requireStoreManager, ar(async (req, res) => {
  const isNum = /^\d+$/.test(String(req.params.id));
  const where = isNum ? `WHERE id=$1` : `WHERE grn_number=$1`;
  const paramVal = isNum ? parseInt(req.params.id) : req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [grn] } = await client.query(`SELECT * FROM grn ${where} FOR UPDATE`, [paramVal]);
    if (!grn) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'GRN record not found' });
    }

    const grnId = grn.id;
    const { rows: items } = await client.query(`SELECT * FROM grn_items WHERE grn_id = $1 FOR UPDATE`, [grnId]);

    // Check stock for all items before rollback
    for (const it of items) {
      const accQty = parseFloat(it.accepted_qty || 0);
      if (accQty <= 0) continue;

      const { rows: [mat] } = await client.query(`SELECT id, name, uom, current_stock FROM materials WHERE id = $1 FOR UPDATE`, [it.material_id]);
      if (mat) {
        const curStock = parseFloat(mat.current_stock || 0);
        const newStock = curStock - accQty;
        if (newStock < 0) {
          throw new Error(`Cannot void GRN ${grn.grn_number}: stock for '${mat.name}' already consumed (Remaining: ${curStock} ${mat.uom})`);
        }
        await client.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [newStock, mat.id]);
      }

      // Revert PO received count
      if (grn.po_id) {
        const recQty = parseFloat(it.received_qty || accQty);
        await client.query(
          `UPDATE po_items SET received_qty = GREATEST(0, COALESCE(received_qty, 0) - $1) WHERE po_id = $2 AND material_id = $3`,
          [recQty, grn.po_id, it.material_id]
        );
      }
    }

    // Revert PO status if all items received were 0
    if (grn.po_id) {
      const { rows: poCheck } = await client.query(
        `SELECT COALESCE(SUM(received_qty), 0) as tot_rec, COALESCE(SUM(qty), 0) as tot_qty FROM po_items WHERE po_id = $1`,
        [grn.po_id]
      );
      const totRec = parseFloat(poCheck[0]?.tot_rec || 0);
      const newPoStatus = totRec <= 0 ? 'Approved' : 'Partial';
      await client.query(`UPDATE purchase_orders SET status = $1 WHERE id = $2`, [newPoStatus, grn.po_id]);
    }

    // Remove stock ledger entries linked to this GRN
    await client.query(
      `DELETE FROM stock_ledger WHERE (reference_type = 'GRN' AND (reference_id = $1 OR reference_id = $2)) OR remarks ILIKE $3`,
      [grnId, String(grnId), `%${grn.grn_number}%`]
    );

    // Delete or void draft vendor bills linked to this GRN
    await client.query(`DELETE FROM vendor_bills WHERE grn_id = $1 AND status = 'Draft'`, [grnId]);

    // Delete GRN items & header
    await client.query(`DELETE FROM grn_items WHERE grn_id = $1`, [grnId]);
    await client.query(`DELETE FROM grn WHERE id = $1`, [grnId]);

    await auditLog(client, {
      userId: req.user.id,
      action: 'store.grn.delete',
      module: 'store',
      recordId: grnId,
      oldData: { grn_number: grn.grn_number, itemCount: items.length },
      newData: { deleted: true },
      ip: req.ip
    });

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `grn-${grnId}`, { event: 'store.grn.deleted', id: grnId, grnNumber: grn.grn_number, userId: req.user.id });

    res.json({ success: true, message: `GRN ${grn.grn_number} successfully deleted and stock reversed.` });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// PUT /api/store/outward/:id — DML Update Outward Issue
router.put('/outward/:id', requireAuth, requireStore, ar(async (req, res) => {
  const { id } = req.params;
  const { out_qty, department_id, machine_id, issued_to, purpose, remarks, date } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [ledger] } = await client.query('SELECT * FROM stock_ledger WHERE id = $1 FOR UPDATE', [id]);
    if (!ledger) throw new Error('Outward record not found');
    if (!['issue', 'out', 'return_to_vendor', 'transfer', 'job_work'].includes(ledger.transaction_type)) {
      throw new Error('Record is not an outward transaction');
    }

    const { rows: [mat] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [ledger.material_id]);
    if (!mat) throw new Error('Material not found');

    const oldQty = parseFloat(ledger.out_qty || 0);
    const newQty = out_qty !== undefined ? parseFloat(out_qty) : oldQty;
    const curStock = parseFloat(mat.current_stock || 0);

    // Revert old issue and apply new issue
    const newStock = curStock + oldQty - newQty;
    if (newStock < 0) {
      throw new Error(`Insufficient stock for update. Available: ${curStock + oldQty} ${mat.uom}, Requested: ${newQty} ${mat.uom}`);
    }

    const price = parseFloat(ledger.unit_price || mat.unit_price || 0);
    const totalVal = newQty * price;

    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStock, mat.id]);

    let deptName = '';
    if (department_id) {
      const { rows: [dept] } = await client.query('SELECT name FROM departments WHERE id = $1', [department_id]);
      if (dept) deptName = dept.name;
    }

    const tagPrefix = ledger.remarks?.includes('[Job Work]')
      ? '[Job Work]'
      : ledger.remarks?.includes('[Return to Party]') || ledger.remarks?.includes('[RTV Outward]')
      ? '[Return to Party]'
      : ledger.remarks?.includes('[Inter Store Transfer]')
      ? '[Inter Store Transfer]'
      : '[Store Issue]';

    const remarkParts = [
      tagPrefix,
      deptName ? `Dept: ${deptName}` : null,
      issued_to ? `To: ${issued_to}` : null,
      purpose ? `Purpose: ${purpose}` : null,
      remarks
    ].filter(Boolean).join(' | ');

    const { rows: [updatedLedger] } = await client.query(`
      UPDATE stock_ledger
      SET out_qty = $1,
          balance = $2,
          value = $3,
          remarks = $4,
          date = COALESCE($5::date, date)
      WHERE id = $6
      RETURNING *
    `, [newQty, newStock, totalVal, remarkParts || ledger.remarks, date || null, id]);

    await auditLog(client, {
      userId: req.user.id,
      action: 'store.outward.update',
      module: 'store',
      recordId: id,
      oldData: { out_qty: oldQty },
      newData: { out_qty: newQty, newStock },
      ip: req.ip
    });

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `outward-${id}`, { event: 'store.outward.updated', id, materialId: mat.id, newQty, newStock, userId: req.user.id });

    res.json({ success: true, message: 'Outward issue updated successfully', data: updatedLedger });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// DELETE /api/store/outward/:id — DML Delete / Cancel Outward Issue
router.delete('/outward/:id', requireAuth, requireStore, ar(async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [ledger] } = await client.query('SELECT * FROM stock_ledger WHERE id = $1 FOR UPDATE', [id]);
    if (!ledger) throw new Error('Outward record not found');
    if (!['issue', 'out', 'return_to_vendor', 'transfer', 'job_work'].includes(ledger.transaction_type)) {
      throw new Error('Record is not an outward transaction');
    }

    const { rows: [mat] } = await client.query('SELECT * FROM materials WHERE id = $1 FOR UPDATE', [ledger.material_id]);
    if (!mat) throw new Error('Material not found');

    const outQty = parseFloat(ledger.out_qty || 0);
    const curStock = parseFloat(mat.current_stock || 0);
    const newStock = curStock + outQty; // Restore back into store stock

    await client.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [newStock, mat.id]);
    await client.query('DELETE FROM stock_ledger WHERE id = $1', [id]);

    await auditLog(client, {
      userId: req.user.id,
      action: 'store.outward.delete',
      module: 'store',
      recordId: id,
      oldData: { material_id: mat.id, out_qty: outQty, curStock },
      newData: { newStock },
      ip: req.ip
    });

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `outward-${id}`, { event: 'store.outward.deleted', id, materialId: mat.id, newStock, userId: req.user.id });

    res.json({ success: true, message: `Outward issue cancelled. Stock restored to store: ${newStock} ${mat.uom}` });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: e.message });
  } finally {
    client.release();
  }
}));

// ── STORE DEPARTMENT-WISE REPORTING ──────────────────────────────────────────
// GET /api/store/reports/department-wise
router.get('/reports/department-wise', requireAuth, ar(async (req, res) => {
  const { from, to } = req.query;

  const dateFilter = [];
  const p = [];
  if (from) { p.push(from); dateFilter.push(`sl.date >= $${p.length}`); }
  if (to)   { p.push(to);   dateFilter.push(`sl.date <= $${p.length}`); }
  const dateClause = dateFilter.length ? 'AND ' + dateFilter.join(' AND ') : '';

  // Confidentiality: non-admins only ever see their own department's data, regardless of any client param
  const isAdmin = req.user.role_level >= 4;
  const deptScopeD = isAdmin ? '' : `AND d.id = $${p.length + 1}`;
  const deptScopeParams = isAdmin ? p : [...p, req.user.department_id];

  // 1. Department-wise summary aggregates
  const deptSummary = await pool.query(`
    SELECT
      d.id AS "departmentId",
      d.name AS "departmentName",
      d.code AS "departmentCode",
      COUNT(sl.id) AS "totalIssues",
      COALESCE(SUM(sl.out_qty), 0) AS "totalQuantity",
      COALESCE(SUM(sl.value), 0) AS "totalValuation",
      COUNT(DISTINCT sl.material_id) AS "distinctMaterials"
    FROM departments d
    LEFT JOIN stock_ledger sl ON (
      (
        sl.remarks ILIKE '%' || d.name || '%'
        OR (
          sl.reference_type = 'indent'
          AND EXISTS (
            SELECT 1 FROM indents ind2
            WHERE ind2.department_id = d.id
              AND sl.remarks ILIKE '%' || ind2.indent_number || '%'
          )
        )
      )
      AND sl.transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer')
      ${dateClause}
    )
    WHERE 1=1 ${deptScopeD}
    GROUP BY d.id, d.name, d.code
    ORDER BY "totalValuation" DESC, "totalIssues" DESC, d.name ASC
  `, deptScopeParams);

  // 2. Department Category Breakdown
  const catBreakdown = await pool.query(`
    SELECT
      d.name AS "departmentName",
      COALESCE(mc.type, 'General') AS "categoryType",
      COUNT(sl.id) AS "issuesCount",
      COALESCE(SUM(sl.out_qty), 0) AS "categoryQty",
      COALESCE(SUM(sl.value), 0) AS "categoryValuation"
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    CROSS JOIN departments d
    WHERE (
        sl.remarks ILIKE '%' || d.name || '%'
        OR (
          sl.reference_type = 'indent'
          AND EXISTS (
            SELECT 1 FROM indents ind2
            WHERE ind2.department_id = d.id
              AND sl.remarks ILIKE '%' || ind2.indent_number || '%'
          )
        )
      )
      AND sl.transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer')
      ${dateClause}
      ${deptScopeD}
    GROUP BY d.name, COALESCE(mc.type, 'General')
    ORDER BY d.name, "categoryValuation" DESC
  `, deptScopeParams);

  // 3. Top Consumed Spares Across Mill
  const topConsumed = await pool.query(`
    SELECT 
      m.id, m.code, m.name, m.uom,
      mc.name AS "categoryName",
      COUNT(sl.id) AS "frequency",
      COALESCE(SUM(sl.out_qty), 0) AS "totalIssuedQty",
      COALESCE(SUM(sl.value), 0) AS "totalCost"
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE sl.transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer')
      ${dateClause}
    GROUP BY m.id, m.code, m.name, m.uom, mc.name
    ORDER BY "totalCost" DESC, "totalIssuedQty" DESC
    LIMIT 15
  `, p);

  // 4. Granular Issue Transactions by Department (for drilldown)
  // Confidentiality: non-admins only see rows attributable to their own department (matched via remarks, same convention as above)
  const deptIssuesScope = isAdmin ? '' : `AND (
        sl.remarks ILIKE '%' || $${p.length + 1} || '%'
        OR (
          sl.reference_type = 'indent'
          AND EXISTS (
            SELECT 1 FROM indents ind2
            WHERE ind2.department_id = $${p.length + 2}
              AND sl.remarks ILIKE '%' || ind2.indent_number || '%'
          )
        )
      )`;
  const deptIssuesParams = isAdmin ? p : [...p, req.user.department, req.user.department_id];
  const deptIssues = await pool.query(`
    SELECT
      sl.id, sl.date, sl.material_id, sl.out_qty, sl.balance, sl.unit_price, sl.value,
      sl.batch_number, sl.remarks, sl.created_at,
      m.name AS "materialName", m.code AS "materialCode", m.uom,
      mc.name AS "categoryName",
      COALESCE(u.name, 'Store Keeper') AS "issuedByName"
    FROM stock_ledger sl
    JOIN materials m ON sl.material_id = m.id
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN users u ON sl.created_by = u.id
    WHERE sl.transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer')
      ${dateClause}
      ${deptIssuesScope}
    ORDER BY sl.id DESC
    LIMIT 100
  `, deptIssuesParams);

  res.json({
    success: true,
    data: {
      departments: deptSummary.rows,
      categoryBreakdown: catBreakdown.rows,
      topConsumed: topConsumed.rows,
      recentIssues: deptIssues.rows
    }
  });
}));

// GET /api/store/reports/store-analytics — Specialized Store Intelligence
router.get('/reports/store-analytics', requireAuth, ar(async (req, res) => {
  // 1. ABC Material Valuation Classification
  const abcSummary = await pool.query(`
    SELECT 
      CASE 
        WHEN (current_stock * unit_price) >= 50000 OR unit_price >= 25000 THEN 'A (High Value)'
        WHEN (current_stock * unit_price) >= 10000 OR unit_price >= 5000 THEN 'B (Medium Value)'
        ELSE 'C (Standard / Bulk)'
      END AS "abcClass",
      COUNT(id) AS "itemCount",
      COALESCE(SUM(current_stock), 0) AS "totalStock",
      COALESCE(SUM(current_stock * unit_price), 0) AS "totalValuation"
    FROM materials
    WHERE is_active = true
    GROUP BY 1
    ORDER BY "totalValuation" DESC
  `);

  // 2. Dead / Non-Moving Inventory (In stock, but 0 issues in stock ledger)
  const deadStock = await pool.query(`
    SELECT 
      m.id, m.code, m.name, m.uom, m.current_stock, m.unit_price,
      (m.current_stock * m.unit_price) AS "blockedValue",
      m.bin_location,
      mc.name AS "categoryName",
      COALESCE(MAX(sl.date), m.created_at::date) AS "lastActivityDate",
      CURRENT_DATE - COALESCE(MAX(sl.date), m.created_at::date) AS "daysInactive"
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN stock_ledger sl ON m.id = sl.material_id AND sl.transaction_type IN ('issue', 'out')
    WHERE m.is_active = true AND m.current_stock > 0
    GROUP BY m.id, m.code, m.name, m.uom, m.current_stock, m.unit_price, m.bin_location, mc.name, m.created_at
    HAVING MAX(sl.date) IS NULL OR (CURRENT_DATE - MAX(sl.date)) >= 30
    ORDER BY "blockedValue" DESC, "daysInactive" DESC
    LIMIT 25
  `);

  // 3. Reorder & Fast Depletion Critical Alerts
  const reorderAlerts = await pool.query(`
    SELECT 
      m.id, m.code, m.name, m.uom, m.current_stock, m.min_stock, m.reorder_level, m.unit_price,
      mc.name AS "categoryName",
      m.bin_location,
      CASE 
        WHEN m.current_stock = 0 THEN 'STOCKOUT'
        WHEN m.current_stock <= m.min_stock THEN 'CRITICAL MINIMUM'
        WHEN m.current_stock <= m.reorder_level THEN 'REORDER REQUIRED'
        ELSE 'NORMAL'
      END AS "alertLevel"
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE m.is_active = true 
      AND (m.current_stock <= COALESCE(m.reorder_level, 0) OR m.current_stock <= COALESCE(m.min_stock, 0) OR m.current_stock = 0)
    ORDER BY (m.current_stock - COALESCE(m.reorder_level, 0)) ASC, m.current_stock ASC
    LIMIT 30
  `);

  // 4. Inward vs Outward Monthly Reconciliation
  const flowReconciliation = await pool.query(`
    SELECT 
      TO_CHAR(date, 'YYYY-MM') AS "month",
      COUNT(*) FILTER (WHERE transaction_type IN ('grn', 'return', 'in')) AS "inwardTxnCount",
      COALESCE(SUM(in_qty) FILTER (WHERE transaction_type IN ('grn', 'return', 'in')), 0) AS "inwardQty",
      COALESCE(SUM(value) FILTER (WHERE transaction_type IN ('grn', 'return', 'in')), 0) AS "inwardValue",
      COUNT(*) FILTER (WHERE transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer')) AS "outwardTxnCount",
      COALESCE(SUM(out_qty) FILTER (WHERE transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer')), 0) AS "outwardQty",
      COALESCE(SUM(value) FILTER (WHERE transaction_type IN ('issue', 'out', 'return_to_vendor', 'transfer')), 0) AS "outwardValue"
    FROM stock_ledger
    WHERE transaction_type != 'opening'
    GROUP BY TO_CHAR(date, 'YYYY-MM')
    ORDER BY "month" DESC
    LIMIT 12
  `);

  res.json({
    success: true,
    data: {
      abcSummary: abcSummary.rows,
      deadStock: deadStock.rows,
      reorderAlerts: reorderAlerts.rows,
      flowReconciliation: flowReconciliation.rows
    }
  });
}));

// GET /api/store/reports/item-wise — per-material consumption drill-down
router.get('/reports/item-wise', requireAuth, ar(async (req, res) => {
  const { from, to, materialId, categoryId } = req.query;
  const p = [];
  const dateFilter = [];
  if (from) { p.push(from); dateFilter.push(`sl.date >= $${p.length}`); }
  if (to)   { p.push(to);   dateFilter.push(`sl.date <= $${p.length}`); }
  const dateClause = dateFilter.length ? 'AND ' + dateFilter.join(' AND ') : '';

  const matFilter = [];
  if (materialId) { p.push(materialId); matFilter.push(`m.id = $${p.length}`); }
  if (categoryId) { p.push(categoryId); matFilter.push(`m.category_id = $${p.length}`); }
  const matClause = matFilter.length ? 'AND ' + matFilter.join(' AND ') : '';

  // Per-item consumption summary
  const items = await pool.query(`
    SELECT
      m.id, m.code, m.name, m.uom, m.current_stock, m.min_stock, m.reorder_level, m.unit_price,
      m.bin_location, mc.name AS "categoryName", mc.id AS "categoryId",
      COUNT(sl.id) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')) AS "issueCount",
      COALESCE(SUM(sl.out_qty) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) AS "totalIssuedQty",
      COALESCE(SUM(sl.value) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) AS "totalIssuedValue",
      COALESCE(SUM(sl.in_qty) FILTER (WHERE sl.transaction_type IN ('grn','return','in')), 0) AS "totalReceivedQty",
      CASE WHEN m.current_stock > 0
        THEN ROUND(COALESCE(SUM(sl.out_qty) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) / m.current_stock, 2)
        ELSE 0 END AS "turnoverRate"
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN stock_ledger sl ON sl.material_id = m.id ${dateClause}
    WHERE m.is_active = true ${matClause}
    GROUP BY m.id, m.code, m.name, m.uom, m.current_stock, m.min_stock, m.reorder_level, m.unit_price, m.bin_location, mc.name, mc.id
    ORDER BY "totalIssuedValue" DESC, "totalIssuedQty" DESC
    LIMIT 300
  `, p);

  // Top issuing departments per item (only when a single material is requested, to keep it fast)
  // Confidentiality: non-admins only see their own department's slice of this breakdown, never other departments'
  let topDepartments = [];
  if (materialId) {
    const p2 = [materialId];
    const dateFilter2 = [];
    if (from) { p2.push(from); dateFilter2.push(`sl.date >= $${p2.length}`); }
    if (to)   { p2.push(to);   dateFilter2.push(`sl.date <= $${p2.length}`); }
    const dateClause2 = dateFilter2.length ? 'AND ' + dateFilter2.join(' AND ') : '';
    const deptScope2 = req.user.role_level >= 4 ? '' : `AND si.department_id = $${p2.length + 1}`;
    if (req.user.role_level < 4) p2.push(req.user.department_id);
    const dq = await pool.query(`
      SELECT d.id AS "departmentId", d.name AS "departmentName",
        COUNT(si.id)::int AS "issueCount",
        COALESCE(SUM(si.quantity), 0) AS "totalQty",
        COALESCE(SUM(si.estimated_value), 0) AS "totalValue"
      FROM store_issues si
      LEFT JOIN departments d ON si.department_id = d.id
      LEFT JOIN stock_ledger sl ON sl.material_id = si.material_id AND sl.date = si.issue_date
      WHERE si.material_id = $1 AND si.status = 'Issued' ${dateClause2} ${deptScope2}
      GROUP BY d.id, d.name
      ORDER BY "totalValue" DESC
      LIMIT 10
    `, p2);
    topDepartments = dq.rows;
  }

  res.json({ success: true, data: { items: items.rows, topDepartments } });
}));

// GET /api/store/reports/category-wise — category/subcategory hierarchy drill-down
router.get('/reports/category-wise', requireAuth, ar(async (req, res) => {
  const { from, to } = req.query;
  const p = [];
  const dateFilter = [];
  if (from) { p.push(from); dateFilter.push(`sl.date >= $${p.length}`); }
  if (to)   { p.push(to);   dateFilter.push(`sl.date <= $${p.length}`); }
  const dateClause = dateFilter.length ? 'AND ' + dateFilter.join(' AND ') : '';

  const rows = await pool.query(`
    WITH mat_agg AS (
      SELECT category_id,
             COUNT(*) AS item_count,
             COALESCE(SUM(current_stock * unit_price), 0) AS stock_value
      FROM materials
      WHERE is_active = true
      GROUP BY category_id
    )
    SELECT
      mc.id AS "categoryId", mc.name AS "categoryName", mc.code AS "categoryCode",
      mc.parent_id AS "parentId", pc.name AS "parentName",
      COALESCE(ma.item_count, 0) AS "itemCount",
      COALESCE(ma.stock_value, 0) AS "stockValue",
      COALESCE(SUM(sl.out_qty) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) AS "issueVolume",
      COALESCE(SUM(sl.value) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) AS "issueValue",
      COALESCE(SUM(sl.in_qty) FILTER (WHERE sl.transaction_type IN ('grn','return','in')), 0) AS "grnInflowVolume",
      COALESCE(SUM(sl.value) FILTER (WHERE sl.transaction_type IN ('grn','return','in')), 0) AS "grnInflowValue"
    FROM material_categories mc
    LEFT JOIN material_categories pc ON pc.id = mc.parent_id
    LEFT JOIN mat_agg ma ON ma.category_id = mc.id
    LEFT JOIN materials m ON m.category_id = mc.id AND m.is_active = true
    LEFT JOIN stock_ledger sl ON sl.material_id = m.id ${dateClause}
    GROUP BY mc.id, mc.name, mc.code, mc.parent_id, pc.name, ma.item_count, ma.stock_value
    ORDER BY "stockValue" DESC, mc.name
  `, p);

  res.json({ success: true, data: rows.rows });
}));

// GET /api/store/reports/bin-location — physical bin/rack location report for stock-take
router.get('/reports/bin-location', requireAuth, ar(async (req, res) => {
  const { binLocation } = req.query;
  const p = [];
  const where = ["m.is_active = true"];
  if (binLocation) { p.push(`%${binLocation}%`); where.push(`m.bin_location ILIKE $${p.length}`); }

  const byBin = await pool.query(`
    SELECT
      COALESCE(m.bin_location, 'UNASSIGNED') AS "binLocation",
      COUNT(m.id) AS "itemCount",
      COALESCE(SUM(m.current_stock), 0) AS "totalStock",
      COALESCE(SUM(m.current_stock * m.unit_price), 0) AS "totalValue"
    FROM materials m
    WHERE ${where.join(' AND ')}
    GROUP BY COALESCE(m.bin_location, 'UNASSIGNED')
    ORDER BY "binLocation"
  `, p);

  const items = await pool.query(`
    SELECT
      m.id, m.code, m.name, m.uom, m.current_stock, m.unit_price, m.bin_location,
      mc.name AS "categoryName",
      (m.current_stock * m.unit_price) AS "stockValue"
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(m.bin_location, 'UNASSIGNED'), m.name
    LIMIT 500
  `, p);

  res.json({ success: true, data: { byBin: byBin.rows, items: items.rows } });
}));

// GET /api/store/reports/vendor-wise — GRN inward volume/value per vendor, price trend
router.get('/reports/vendor-wise', requireAuth, ar(async (req, res) => {
  const { from, to, vendorId } = req.query;
  const p = [];
  const gWhere = ["1=1"];
  if (from) { p.push(from); gWhere.push(`g.date >= $${p.length}`); }
  if (to)   { p.push(to);   gWhere.push(`g.date <= $${p.length}`); }
  if (vendorId) { p.push(vendorId); gWhere.push(`g.vendor_id = $${p.length}`); }

  const vendors = await pool.query(`
    SELECT
      v.id AS "vendorId", v.name AS "vendorName", v.code AS "vendorCode", v.rating,
      COALESCE(g_agg."grnCount", 0) AS "grnCount",
      COALESCE(g_agg."totalAcceptedQty", 0) AS "totalAcceptedQty",
      COALESCE(g_agg."totalRejectedQty", 0) AS "totalRejectedQty",
      COALESCE(g_agg."totalInwardValue", 0) AS "totalInwardValue",
      COALESCE(g_agg."distinctMaterials", 0) AS "distinctMaterials",
      COALESCE(g_agg."poCount", 0) AS "poCount",
      COALESCE(g_agg."onTimeDeliveries", 0) AS "onTimeDeliveries"
    FROM vendors v
    LEFT JOIN (
      SELECT g.vendor_id,
        COUNT(DISTINCT g.id) AS "grnCount",
        COALESCE(SUM(gi.accepted_qty), 0) AS "totalAcceptedQty",
        COALESCE(SUM(gi.rejected_qty), 0) AS "totalRejectedQty",
        COALESCE(SUM(gi.accepted_qty * gi.unit_price), 0) AS "totalInwardValue",
        COUNT(DISTINCT gi.material_id) AS "distinctMaterials",
        COUNT(DISTINCT po.id) AS "poCount",
        COUNT(DISTINCT po.id) FILTER (WHERE po.delivery_date IS NOT NULL AND g.date <= po.delivery_date) AS "onTimeDeliveries"
      FROM grn g
      LEFT JOIN grn_items gi ON gi.grn_id = g.id
      LEFT JOIN purchase_orders po ON po.id = g.po_id
      WHERE ${gWhere.join(' AND ')}
      GROUP BY g.vendor_id
    ) g_agg ON g_agg.vendor_id = v.id
    WHERE COALESCE(g_agg."grnCount", 0) > 0
    ORDER BY "totalInwardValue" DESC
  `, p);

  // Price trend per material per vendor (only when a specific vendor is requested)
  let priceTrend = [];
  if (vendorId) {
    const p2 = [vendorId];
    const dateFilter2 = [];
    if (from) { p2.push(from); dateFilter2.push(`g.date >= $${p2.length}`); }
    if (to)   { p2.push(to);   dateFilter2.push(`g.date <= $${p2.length}`); }
    const dateClause2 = dateFilter2.length ? 'AND ' + dateFilter2.join(' AND ') : '';
    const pt = await pool.query(`
      SELECT
        m.id AS "materialId", m.name AS "materialName", m.code AS "materialCode",
        g.date, gi.unit_price, gi.accepted_qty, g.grn_number
      FROM grn_items gi
      JOIN grn g ON gi.grn_id = g.id
      JOIN materials m ON gi.material_id = m.id
      WHERE g.vendor_id = $1 ${dateClause2}
      ORDER BY m.name, g.date
      LIMIT 500
    `, p2);
    priceTrend = pt.rows;
  }

  res.json({ success: true, data: { vendors: vendors.rows, priceTrend } });
}));

// GET /api/store/reports/movement-analysis — fast/slow/dead-stock movement classification
router.get('/reports/movement-analysis', requireAuth, ar(async (req, res) => {
  const { from, to } = req.query;
  const p = [];
  const dateFilter = [];
  if (from) { p.push(from); dateFilter.push(`sl.date >= $${p.length}`); }
  else      { dateFilter.push(`sl.date >= (CURRENT_DATE - INTERVAL '90 days')`); }
  if (to)   { p.push(to);   dateFilter.push(`sl.date <= $${p.length}`); }
  const dateClause = 'AND ' + dateFilter.join(' AND ');
  const params = p;

  const rows = await pool.query(`
    SELECT
      m.id, m.code, m.name, m.uom, m.current_stock, m.unit_price, m.bin_location,
      mc.name AS "categoryName",
      (m.current_stock * m.unit_price) AS "stockValue",
      COUNT(sl.id) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')) AS "movementCount",
      COALESCE(SUM(sl.out_qty) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')), 0) AS "movementQty",
      MAX(sl.date) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')) AS "lastIssueDate",
      CASE
        WHEN COUNT(sl.id) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')) = 0 THEN 'DEAD'
        WHEN COUNT(sl.id) FILTER (WHERE sl.transaction_type IN ('issue','out','return_to_vendor','transfer')) >= 5 THEN 'FAST'
        ELSE 'SLOW'
      END AS "movementClass"
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN stock_ledger sl ON sl.material_id = m.id ${dateClause}
    WHERE m.is_active = true
    GROUP BY m.id, m.code, m.name, m.uom, m.current_stock, m.unit_price, m.bin_location, mc.name
    ORDER BY "movementCount" DESC, "stockValue" DESC
    LIMIT 500
  `, params);

  const summary = {
    fast: rows.rows.filter(r => r.movementClass === 'FAST').length,
    slow: rows.rows.filter(r => r.movementClass === 'SLOW').length,
    dead: rows.rows.filter(r => r.movementClass === 'DEAD').length,
    deadStockValue: rows.rows.filter(r => r.movementClass === 'DEAD').reduce((a, r) => a + parseFloat(r.stockValue || 0), 0)
  };

  res.json({ success: true, data: { items: rows.rows, summary } });
}));

// ============================================================================
// REJECTIONS & RETURN TO VENDOR (RTV) ENDPOINTS
// ============================================================================

// GET /api/store/rejections — List all material rejections with vendor, PO, and RTV status
router.get('/rejections', requireAuth, ar(async (req, res) => {
  const { status, vendorId, materialId } = req.query;
  const where = ['1=1'];
  const params = [];

  if (status) {
    params.push(status);
    where.push(`mr.status = $${params.length}`);
  }
  if (vendorId) {
    params.push(vendorId);
    where.push(`mr.vendor_id = $${params.length}`);
  }
  if (materialId) {
    params.push(materialId);
    where.push(`mr.material_id = $${params.length}`);
  }

  const { rows } = await pool.query(`
    SELECT mr.*,
           m.code AS "materialCode", m.name AS "materialName",
           v.name AS "vendorName", v.code AS "vendorCode",
           po.po_number AS "poNumber",
           g.grn_number AS "grnNumber",
           qt.test_number AS "testNumber",
           gp.gp_number AS "outwardGatePassNumber",
           u.name AS "createdByName"
    FROM material_rejections mr
    LEFT JOIN materials m ON mr.material_id = m.id
    LEFT JOIN vendors v ON mr.vendor_id = v.id
    LEFT JOIN purchase_orders po ON mr.po_id = po.id
    LEFT JOIN grn g ON mr.grn_id = g.id
    LEFT JOIN quality_tests qt ON mr.qc_test_id = qt.id
    LEFT JOIN gate_passes gp ON mr.outward_gate_pass_id = gp.id
    LEFT JOIN users u ON mr.created_by = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY mr.created_at DESC
  `, params);

  const { rows: [summary] } = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'Pending RTV') AS pending,
      COUNT(*) FILTER (WHERE status = 'Debit Note Raised') AS debit_raised,
      COUNT(*) FILTER (WHERE status = 'Dispatched Out') AS dispatched,
      COALESCE(SUM(debit_amount) FILTER (WHERE status IN ('Pending RTV', 'Debit Note Raised')), 0) AS pending_debit_amount
    FROM material_rejections
  `);

  res.json({ success: true, data: rows, summary });
}));

// POST /api/store/rejections/:id/dispatch-rtv — Dispatch rejected goods and generate Outward Gate Pass
router.post('/rejections/:id/dispatch-rtv', requireAuth, requireStore, ar(async (req, res) => {
  const { vehicleNumber, driverName, remarks } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [rej] } = await client.query(`
      SELECT mr.*, v.name AS vendor_name, m.name AS material_name
      FROM material_rejections mr
      LEFT JOIN vendors v ON mr.vendor_id = v.id
      LEFT JOIN materials m ON mr.material_id = m.id
      WHERE mr.id = $1 FOR UPDATE
    `, [req.params.id]);

    if (!rej) throw new Error('Rejection record not found');
    if (rej.status === 'Dispatched Out' || rej.status === 'Closed') {
      throw new Error(`Rejection is already in '${rej.status}' status`);
    }

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`gp-${stamp}`]);
    const seq = await client.query('SELECT COUNT(*)+1 AS n FROM gate_passes WHERE date::date = CURRENT_DATE');
    const num = `GP-${stamp}-${String(seq.rows[0].n).padStart(4,'0')}`;

    const desc = `RTV Dispatch: ${rej.rejected_qty} ${rej.uom} of ${rej.material_name} (Ref: ${rej.rejection_number})`;
    const { rows: [gp] } = await client.query(`
      INSERT INTO gate_passes (gp_number, pass_type, vehicle_type, vehicle_number, driver_name, purpose,
        material_description, from_party, to_party, out_time, security_guard_id, remarks,
        po_id, vendor_id, status)
      VALUES ($1, 'OUT', 'Truck', $2, $3, 'Return to Vendor (RTV)',
        $4, 'MK Paper Mill', $5, NOW(), $6, $7,
        $8, $9, 'Closed') RETURNING id, gp_number
    `, [num, vehicleNumber || 'Vendor Vehicle', driverName || 'Vendor Driver',
        desc, rej.vendor_name || 'Vendor', req.user.id, remarks || `RTV ${rej.rejection_number}`,
        rej.po_id, rej.vendor_id]);

    await client.query(`
      UPDATE material_rejections
      SET status = 'Dispatched Out', outward_gate_pass_id = $1
      WHERE id = $2
    `, [gp.id, req.params.id]);

    await client.query('COMMIT');
    publish(TOPICS.EVENTS_ALL, `rtv-${rej.id}`, { event: 'store.rtv.dispatched', id: rej.id, gatePassId: gp.id, gpNumber: gp.gp_number, userId: req.user.id });
    res.json({ success: true, data: { gatePassId: gp.id, gpNumber: gp.gp_number } });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// PUT /api/store/gate-passes/:id — Edit Gate Pass details (vehicle, driver, party, purpose, return date, remarks)
router.put('/gate-passes/:id', requireAuth, ar(async (req, res) => {
  const { id } = req.params;
  const { vehicle_number, driver_name, to_party, from_party, purpose, material_description, remarks, expected_return_date, status } = req.body;

  const { rows: [gp] } = await pool.query('SELECT * FROM gate_passes WHERE id = $1', [id]);
  if (!gp) return res.status(404).json({ success: false, message: 'Gate pass not found' });
  if (gp.status === 'Closed' && (req.user?.role_level || 1) < 4) {
    return res.status(400).json({ success: false, message: 'Cannot edit a closed gate pass' });
  }

  const { rows: [updated] } = await pool.query(`
    UPDATE gate_passes SET
      vehicle_number = COALESCE($1, vehicle_number),
      driver_name = COALESCE($2, driver_name),
      to_party = COALESCE($3, to_party),
      from_party = COALESCE($4, from_party),
      purpose = COALESCE($5, purpose),
      material_description = COALESCE($6, material_description),
      remarks = COALESCE($7, remarks),
      expected_return_date = COALESCE($8, expected_return_date),
      status = COALESCE($9, status)
    WHERE id = $10 RETURNING *
  `, [vehicle_number || null, driver_name || null, to_party || null, from_party || null, purpose || null, material_description || null, remarks || null, expected_return_date || null, status || null, id]);

  res.json({ success: true, data: updated, message: 'Gate pass updated successfully' });
}));

// ============================================================================
// INTER-STORE TRANSFERS (STO) ENDPOINTS
// ============================================================================

// GET /api/store/transfers — List all stock transfer orders
router.get('/transfers', requireAuth, ar(async (req, res) => {
  const { status, fromWarehouseId, toWarehouseId } = req.query;
  const where = ['1=1'];
  const params = [];

  if (status) { params.push(status); where.push(`st.status = $${params.length}`); }
  if (fromWarehouseId) { params.push(fromWarehouseId); where.push(`st.from_warehouse_id = $${params.length}`); }
  if (toWarehouseId) { params.push(toWarehouseId); where.push(`st.to_warehouse_id = $${params.length}`); }

  const { rows } = await pool.query(`
    SELECT st.*,
           fw.name AS "fromWarehouseName",
           tw.name AS "toWarehouseName",
           ur.name AS "requestedByName",
           ua.name AS "approvedByName",
           ud.name AS "dispatchedByName",
           uc.name AS "receivedByName"
    FROM store_transfers st
    LEFT JOIN warehouses fw ON st.from_warehouse_id = fw.id
    LEFT JOIN warehouses tw ON st.to_warehouse_id = tw.id
    LEFT JOIN users ur ON st.requested_by = ur.id
    LEFT JOIN users ua ON st.approved_by = ua.id
    LEFT JOIN users ud ON st.dispatched_by = ud.id
    LEFT JOIN users uc ON st.received_by = uc.id
    WHERE ${where.join(' AND ')}
    ORDER BY st.created_at DESC
  `, params);

  // Fetch items for transfers
  for (const t of rows) {
    const itemsRes = await pool.query(`
      SELECT sti.*, m.code AS "materialCode", m.name AS "materialName", m.unit_price AS "unitPrice"
      FROM store_transfer_items sti
      LEFT JOIN materials m ON sti.material_id = m.id
      WHERE sti.transfer_id = $1
    `, [t.id]);
    t.items = itemsRes.rows;
  }

  res.json({ success: true, data: rows });
}));

// POST /api/store/transfers — Create Inter-Store Transfer Order (STO)
router.post('/transfers', requireAuth, requireStore, ar(async (req, res) => {
  const { fromWarehouseId, toWarehouseId, transferDate, remarks, items = [] } = req.body;
  if (!fromWarehouseId || !toWarehouseId || !items.length) {
    return res.status(400).json({ success: false, message: 'fromWarehouseId, toWarehouseId, and items required' });
  }
  if (fromWarehouseId === toWarehouseId) {
    return res.status(400).json({ success: false, message: 'Source and Destination warehouses must be different' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sto-${stamp}`]);
    const seqRes = await client.query(`SELECT COUNT(*)+1 AS n FROM store_transfers WHERE created_at::date = CURRENT_DATE`);
    const stoNum = `STO-${stamp}-${String(seqRes.rows[0].n).padStart(4, '0')}`;

    const { rows: [transfer] } = await client.query(`
      INSERT INTO store_transfers
        (transfer_number, from_warehouse_id, to_warehouse_id, transfer_date, status, requested_by, remarks)
      VALUES ($1, $2, $3, $4, 'Approved', $5, $6)
      RETURNING *
    `, [stoNum, fromWarehouseId, toWarehouseId, transferDate || new Date(), req.user.id, remarks || null]);

    for (const item of items) {
      if (!item.materialId || !item.qty) continue;
      const { rows: [mat] } = await client.query(`SELECT uom, current_stock FROM materials WHERE id = $1`, [item.materialId]);
      await client.query(`
        INSERT INTO store_transfer_items (transfer_id, material_id, qty, uom, batch_number, remarks)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [transfer.id, item.materialId, item.qty, item.uom || mat?.uom || 'Nos', item.batchNumber || null, item.remarks || null]);
    }

    await client.query('COMMIT');
    res.json({ success: true, data: transfer });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// PUT /api/store/transfers/:id/dispatch — Dispatch stock (In Transit)
router.put('/transfers/:id/dispatch', requireAuth, requireStore, ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [transfer] } = await client.query(`SELECT * FROM store_transfers WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== 'Approved' && transfer.status !== 'Requested') {
      throw new Error(`Cannot dispatch transfer in '${transfer.status}' status`);
    }

    const { rows: items } = await client.query(`SELECT * FROM store_transfer_items WHERE transfer_id = $1`, [transfer.id]);
    for (const item of items) {
      const { rows: [mat] } = await client.query(`SELECT id, current_stock, unit_price FROM materials WHERE id = $1 FOR UPDATE`, [item.material_id]);
      if (parseFloat(mat.current_stock) < parseFloat(item.qty)) {
        throw new Error(`Insufficient stock for item ID ${item.material_id}. Available: ${mat.current_stock}`);
      }

      const newStock = parseFloat(mat.current_stock) - parseFloat(item.qty);
      await client.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [newStock, item.material_id]);

      await client.query(`
        INSERT INTO stock_ledger (material_id, transaction_type, out_qty, balance, unit_price, value, date, reference_type, reference_id, remarks, created_by)
        VALUES ($1, 'transfer', $2, $3, $4, $5, CURRENT_DATE, 'store_transfer', $6, $7, $8)
      `, [item.material_id, item.qty, newStock, mat.unit_price,
          parseFloat(item.qty) * parseFloat(mat.unit_price), transfer.id,
          `STO Dispatch: #${transfer.transfer_number}`, req.user.id]);
    }

    await client.query(`
      UPDATE store_transfers SET status = 'In Transit', dispatched_by = $1 WHERE id = $2
    `, [req.user.id, transfer.id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// PUT /api/store/transfers/:id/receive — Receive stock at destination warehouse
router.put('/transfers/:id/receive', requireAuth, requireStore, ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [transfer] } = await client.query(`SELECT * FROM store_transfers WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== 'In Transit') {
      throw new Error(`Cannot receive transfer in '${transfer.status}' status — must be 'In Transit'`);
    }

    const { rows: items } = await client.query(`SELECT * FROM store_transfer_items WHERE transfer_id = $1`, [transfer.id]);
    for (const item of items) {
      const { rows: [mat] } = await client.query(`SELECT id, current_stock, unit_price FROM materials WHERE id = $1 FOR UPDATE`, [item.material_id]);
      const newStock = parseFloat(mat.current_stock || 0) + parseFloat(item.qty);
      await client.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [newStock, item.material_id]);

      await client.query(`
        INSERT INTO stock_ledger (material_id, transaction_type, in_qty, balance, unit_price, value, date, reference_type, reference_id, remarks, created_by)
        VALUES ($1, 'transfer', $2, $3, $4, $5, CURRENT_DATE, 'store_transfer', $6, $7, $8)
      `, [item.material_id, item.qty, newStock, mat.unit_price,
          parseFloat(item.qty) * parseFloat(mat.unit_price), transfer.id,
          `STO Received: #${transfer.transfer_number}`, req.user.id]);
    }

    await client.query(`
      UPDATE store_transfers SET status = 'Completed', received_by = $1 WHERE id = $2
    `, [req.user.id, transfer.id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// ============================================================================
// STORE RETURN VOUCHERS (SRV) ENDPOINTS
// ============================================================================

// GET /api/store/returns — List all store returns
router.get('/returns', requireAuth, ar(async (req, res) => {
  const { status, departmentId } = req.query;
  const where = ['1=1'];
  const params = [];

  if (status) { params.push(status); where.push(`sr.status = $${params.length}`); }
  if (departmentId) { params.push(departmentId); where.push(`sr.department_id = $${params.length}`); }

  const { rows } = await pool.query(`
    SELECT sr.*,
           d.name AS "departmentName",
           ind.indent_number AS "indentNumber",
           ur.name AS "returnedByName",
           ui.name AS "inspectedByName"
    FROM store_returns sr
    LEFT JOIN departments d ON sr.department_id = d.id
    LEFT JOIN indents ind ON sr.indent_id = ind.id
    LEFT JOIN users ur ON sr.returned_by = ur.id
    LEFT JOIN users ui ON sr.inspected_by = ui.id
    WHERE ${where.join(' AND ')}
    ORDER BY sr.created_at DESC
  `, params);

  for (const r of rows) {
    const itemsRes = await pool.query(`
      SELECT sri.*, m.code AS "materialCode", m.name AS "materialName", m.unit_price AS "unitPrice"
      FROM store_return_items sri
      LEFT JOIN materials m ON sri.material_id = m.id
      WHERE sri.return_id = $1
    `, [r.id]);
    r.items = itemsRes.rows;
  }

  res.json({ success: true, data: rows });
}));

// POST /api/store/returns — Raise Store Return Voucher (SRV)
router.post('/returns', requireAuth, ar(async (req, res) => {
  const { departmentId, indentId, returnDate, remarks, items = [] } = req.body;
  if (!departmentId || !items.length) {
    return res.status(400).json({ success: false, message: 'departmentId and items required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`srv-${stamp}`]);
    const seqRes = await client.query(`SELECT COUNT(*)+1 AS n FROM store_returns WHERE created_at::date = CURRENT_DATE`);
    const srvNum = `SRV-${stamp}-${String(seqRes.rows[0].n).padStart(4, '0')}`;

    const { rows: [ret] } = await client.query(`
      INSERT INTO store_returns (return_number, department_id, indent_id, return_date, status, returned_by, remarks)
      VALUES ($1, $2, $3, $4, 'Submitted', $5, $6) RETURNING *
    `, [srvNum, departmentId, indentId || null, returnDate || new Date(), req.user.id, remarks || null]);

    for (const item of items) {
      if (!item.materialId || !item.qty) continue;
      const { rows: [mat] } = await client.query(`SELECT uom, name FROM materials WHERE id = $1`, [item.materialId]);

      // Guard: when this return references an original Indent, don't let cumulative
      // returns for that indent+material exceed what was ever requested on it —
      // prevents a department over-returning more than it was issued.
      if (indentId) {
        const { rows: [reqRow] } = await client.query(
          `SELECT COALESCE(SUM(required_qty), 0) AS req FROM indent_items WHERE indent_id = $1 AND material_id = $2`,
          [indentId, item.materialId]
        );
        const { rows: [retRow] } = await client.query(
          `SELECT COALESCE(SUM(sri.qty), 0) AS returned
           FROM store_return_items sri JOIN store_returns sr ON sr.id = sri.return_id
           WHERE sr.indent_id = $1 AND sri.material_id = $2 AND sr.status != 'Rejected'`,
          [indentId, item.materialId]
        );
        const requested = Number(reqRow?.req || 0);
        const alreadyReturned = Number(retRow?.returned || 0);
        if (requested > 0 && alreadyReturned + Number(item.qty) > requested) {
          throw new Error(`Cannot return ${item.qty} of ${mat?.name || 'material'} against this indent — only ${(requested - alreadyReturned).toFixed(3)} remains returnable (requested ${requested}, already returned ${alreadyReturned}).`);
        }
      }

      await client.query(`
        INSERT INTO store_return_items (return_id, material_id, qty, uom, condition_grade, action_taken, remarks)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [ret.id, item.materialId, item.qty, item.uom || mat?.uom || 'Nos', item.conditionGrade || 'Good', item.actionTaken || 'Restocked to Store', item.remarks || null]);
    }

    await client.query('COMMIT');
    res.json({ success: true, data: ret });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// PUT /api/store/returns/:id/inspect — Store inspection and stock credit for Good condition
router.put('/returns/:id/inspect', requireAuth, requireStore, ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ret] } = await client.query(`SELECT * FROM store_returns WHERE id = $1 FOR UPDATE`, [req.params.id]);
    if (!ret) throw new Error('Return voucher not found');

    const { rows: items } = await client.query(`SELECT * FROM store_return_items WHERE return_id = $1`, [ret.id]);
    for (const item of items) {
      if (item.condition_grade === 'Good') {
        await client.query(`UPDATE materials SET current_stock = current_stock + $1 WHERE id = $2`, [item.qty, item.material_id]);
        const { rows: [bal] } = await client.query(`SELECT current_stock, unit_price FROM materials WHERE id = $1`, [item.material_id]);
        await client.query(`
          INSERT INTO stock_ledger (material_id, transaction_type, in_qty, balance, unit_price, value, date, reference_type, reference_id, remarks, created_by)
          VALUES ($1, 'return', $2, $3, $4, $5, CURRENT_DATE, 'store_return', $6, $7, $8)
        `, [item.material_id, item.qty, bal.current_stock, bal.unit_price, parseFloat(item.qty) * parseFloat(bal.unit_price),
            ret.id, `SRV Restock: #${ret.return_number}`, req.user.id]);
      }
    }

    await client.query(`
      UPDATE store_returns SET status = 'Restocked', inspected_by = $1 WHERE id = $2
    `, [req.user.id, ret.id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

module.exports = router;

