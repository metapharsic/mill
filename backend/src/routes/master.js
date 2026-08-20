const path = require('path');
const router = require('express').Router();
const pool = require('../db/pool');
const multer = require('multer');
const xlsx = require('xlsx');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const { auth, requireLevel } = require('../middleware/auth');
const { publish, TOPICS } = require('../kafka');
const { runImport: runMechImport, DEFAULT_FILE: DEFAULT_MECH_FILE } = require('../../scripts/import_mechanical_store');
const { runImport: runElecImport, DEFAULT_FILE: DEFAULT_ELEC_FILE } = require('../../scripts/import_electrical_store');
const { runImport: runVendorImport, DEFAULT_FILE: DEFAULT_VENDOR_FILE } = require('../../scripts/import_vendors');
const { getVendors, countVendors } = require('../middleware/helpers');
const { generateInventoryExcel } = require('../services/inventoryExcelExporter');
const ar = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Doc31 #21: master-data mutations wrote no audit trail. Generic router-level logger — covers every
// POST/PUT/DELETE in this file without hand-editing each of the ~24 routes. Fires after response commits,
// only on 2xx, never blocks the request.
router.use((req, res, next) => {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      pool.query(
        `INSERT INTO audit_log (user_id, module, action, record_id, new_data, ip_address)
         VALUES ($1,'master',$2,$3,$4,$5)`,
        [req.user.id, `${req.method} ${req.path}`, req.params.id || null, JSON.stringify(req.body), req.ip]
      ).catch(() => {}); // fail-safe, mirrors kafka publish() pattern — never breaks the actual request
    }
  });
  next();
});

// ── UNITS OF MEASUREMENT (UOM) ───────────────────────────────────────────────
const { UOM_CATEGORIES, ALL_UOM_CODES } = require('../constants/uom');
router.get('/uoms', auth, ar(async (req, res) => {
  // Query any custom UOMs stored in the database materials table
  const { rows: distinctUoms } = await pool.query(`
    SELECT DISTINCT uom FROM materials WHERE uom IS NOT NULL AND uom != '' ORDER BY uom ASC
  `);
  const dbUomCodes = distinctUoms.map(r => r.uom.trim().toUpperCase());
  const allCodes = Array.from(new Set([...ALL_UOM_CODES, ...dbUomCodes]));

  res.json({
    success: true,
    data: {
      categories: UOM_CATEGORIES,
      allCodes,
      count: allCodes.length
    }
  });
}));

// ── MACHINES ─────────────────────────────────────────────────────────────────
// Schema: id, name, code, type, capacity_tpd, is_active
router.get('/machines', auth, ar(async (req, res) => {
  const { is_active, search } = req.query;
  const w = []; const p = []; let i = 1;
  if (is_active !== undefined) { w.push(`is_active=$${i++}`); p.push(is_active === 'true'); }
  if (search) { w.push(`(name ILIKE $${i} OR code ILIKE $${i})`); p.push(`%${search}%`); i++; }
  const { rows } = await pool.query(
    `SELECT * FROM machines ${w.length ? 'WHERE '+w.join(' AND ') : ''} ORDER BY name`, p);
  res.json({ success: true, data: rows });
}));

router.post('/machines', auth, requireLevel(4), ar(async (req, res) => {
  const { name, code, type, capacity_tpd, ideal_speed_mpm, design_speed_mpm } = req.body;
  if (!name || !code) return res.status(400).json({ success: false, message: 'name and code required' });
  const { rows } = await pool.query(
    `INSERT INTO machines (name, code, type, capacity_tpd, ideal_speed_mpm, design_speed_mpm) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, code, type, capacity_tpd || null, ideal_speed_mpm || 0, design_speed_mpm || 0]);
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/machines/:id', auth, requireLevel(4), ar(async (req, res) => {
  const { name, code, type, capacity_tpd, is_active, ideal_speed_mpm, design_speed_mpm } = req.body;
  await pool.query(
    `UPDATE machines SET name=$1,code=$2,type=$3,capacity_tpd=$4,is_active=$5,ideal_speed_mpm=$7,design_speed_mpm=$8 WHERE id=$6`,
    [name, code, type, capacity_tpd, is_active, req.params.id, ideal_speed_mpm || 0, design_speed_mpm || 0]);
  res.json({ success: true });
}));

// ── MACHINE POSITIONS ────────────────────────────────────────────────────────
router.get('/machines/:id/positions', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM machine_positions WHERE machine_id=$1 ORDER BY name`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
}));

router.post('/machines/:id/positions', auth, requireLevel(4), ar(async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ success: false, message: 'name and code required' });
  const { rows } = await pool.query(
    `INSERT INTO machine_positions (machine_id, name, code) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.id, name, code]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/machine-positions/:id', auth, requireLevel(4), ar(async (req, res) => {
  const { name, code, is_active } = req.body;
  await pool.query(
    `UPDATE machine_positions SET name=$1,code=$2,is_active=$3 WHERE id=$4`,
    [name, code, is_active, req.params.id]
  );
  res.json({ success: true });
}));

// ── GRADES ───────────────────────────────────────────────────────────────────
// Schema: id, name, code, gsm_min, gsm_max, description, is_active
router.get('/grades', auth, ar(async (req, res) => {
  const { is_active } = req.query;
  const where = is_active !== undefined ? `WHERE is_active=${is_active === 'true'}` : '';
  const { rows } = await pool.query(`SELECT * FROM grades ${where} ORDER BY name`);
  res.json({ success: true, data: rows });
}));

router.post('/grades', auth, requireLevel(4), ar(async (req, res) => {
  const { name, code, gsm_min, gsm_max, description } = req.body;
  if (!name || !code) return res.status(400).json({ success: false, message: 'name and code required' });
  const { rows } = await pool.query(
    `INSERT INTO grades (name,code,gsm_min,gsm_max,description) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, code, gsm_min || null, gsm_max || null, description]);
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/grades/:id', auth, requireLevel(4), ar(async (req, res) => {
  const { name, code, gsm_min, gsm_max, description, is_active } = req.body;
  await pool.query(
    `UPDATE grades SET name=$1,code=$2,gsm_min=$3,gsm_max=$4,description=$5,is_active=$6 WHERE id=$7`,
    [name, code, gsm_min, gsm_max, description, is_active, req.params.id]);
  res.json({ success: true });
}));

// ── MATERIAL CATEGORIES ──────────────────────────────────────────────────────
// Schema: id, name, code, type, parent_id (self-referencing FK; any category can have a parent)
router.get('/categories', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT mc.*, parent.name AS "parentName"
     FROM material_categories mc
     LEFT JOIN material_categories parent ON parent.id = mc.parent_id
     ORDER BY mc.name`);
  res.json({ success: true, data: rows });
}));

router.get('/categories/tree', auth, ar(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, code, type, parent_id FROM material_categories ORDER BY name');
  const byId = new Map(rows.map(r => [r.id, { id: r.id, name: r.name, code: r.code, children: [] }]));
  const roots = [];
  for (const r of rows) {
    const node = byId.get(r.id);
    if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).children.push(node);
    else roots.push(node);
  }
  res.json({ success: true, data: roots });
}));

router.post('/categories', auth, requireLevel(1), ar(async (req, res) => {
  const { name, code, type, parent_id } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'name required' });
  const { rows } = await pool.query(
    `INSERT INTO material_categories (name,code,type,parent_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, code, type, parent_id || null]);
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/categories/:id', auth, requireLevel(1), ar(async (req, res) => {
  const { name, code, type } = req.body;
  // parent_id: distinguish "field omitted" (keep existing) from "explicitly set to null" (clear it)
  const parentIdProvided = Object.prototype.hasOwnProperty.call(req.body, 'parent_id');
  const parent_id = parentIdProvided ? (req.body.parent_id || null) : undefined;
  await pool.query(
    `UPDATE material_categories SET name=COALESCE($1,name),code=COALESCE($2,code),type=COALESCE($3,type),
     parent_id=CASE WHEN $5::boolean THEN $4 ELSE parent_id END WHERE id=$6`,
    [name, code, type, parent_id ?? null, parentIdProvided, req.params.id]);
  res.json({ success: true });
}));

// ── MATERIALS ────────────────────────────────────────────────────────────────
// parseNum: converts empty-string / null / undefined → null so PostgreSQL
// does not try to cast '' as numeric (which throws "invalid input syntax").
const parseNum = v => (v === '' || v === null || v === undefined) ? null : Number(v);

// ── SECTIONS & SECTION EQUIPMENT MASTER LOOKUPS ──────────────────────────────
router.get('/sections', auth, ar(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT ps.id, ps.section_code AS "sectionCode", ps.name, ps.icon, ps.description, ps.sort_order AS "sortOrder"
    FROM plant_sections ps
    WHERE ps.is_active = true
    ORDER BY ps.sort_order, ps.name
  `);
  res.json({ success: true, data: rows });
}));

router.get('/section-equipment', auth, ar(async (req, res) => {
  const { section_id, machine_id } = req.query;
  const w = ['se.is_active = true'];
  const p = [];
  let i = 1;
  if (section_id) { w.push(`se.section_id = $${i++}`); p.push(parseInt(section_id)); }
  if (machine_id) { w.push(`se.machine_id = $${i++}`); p.push(parseInt(machine_id)); }
  const { rows } = await pool.query(`
    SELECT se.id, se.section_id AS "sectionId", se.machine_id AS "machineId",
           se.tag_name AS "tagName", se.equipment_name AS "equipmentName",
           se.equipment_type AS "equipmentType", se.remarks,
           ps.name AS "sectionName", ps.section_code AS "sectionCode",
           m.name AS "machineName", m.code AS "machineCode"
    FROM section_equipment se
    LEFT JOIN plant_sections ps ON ps.id = se.section_id
    LEFT JOIN machines m ON m.id = se.machine_id
    WHERE ${w.join(' AND ')}
    ORDER BY ps.sort_order NULLS LAST, ps.name, se.equipment_name
  `, p);
  res.json({ success: true, data: rows });
}));

// Schema: id, code, name, category_id, uom, hsn_code, reorder_level, min_stock, max_stock, current_stock, unit_price, is_active, section_id, machine_id, section_equipment_id
router.get('/materials', auth, ar(async (req, res) => {
  const { category_id, is_active, search, criticality_class, section_context, section_id, machine_id, section_equipment_id, sort_by, sort_order = 'ASC', page = 1, limit = 50 } = req.query;
  const w = []; const p = []; let i = 1;
  if (category_id)        { w.push(`m.category_id IN (SELECT id FROM material_categories WHERE id=$${i} OR parent_id=$${i})`); p.push(category_id); i++; }
  if (is_active !== undefined) { w.push(`m.is_active=$${i++}`);     p.push(is_active === 'true'); }
  if (criticality_class)  { w.push(`m.criticality_class=$${i++}`);  p.push(criticality_class.toUpperCase()); }
  if (section_id)         { w.push(`m.section_id = $${i++}`);      p.push(parseInt(section_id)); }
  if (machine_id)         { w.push(`m.machine_id = $${i++}`);      p.push(parseInt(machine_id)); }
  if (section_equipment_id) { w.push(`m.section_equipment_id = $${i++}`); p.push(parseInt(section_equipment_id)); }
  if (section_context)    { w.push(`m.section_context ILIKE $${i++}`); p.push(`%${section_context}%`); }
  if (search)             { w.push(`(m.name ILIKE $${i} OR m.code ILIKE $${i} OR m.oem_supplier ILIKE $${i} OR ps.name ILIKE $${i} OR mac.name ILIKE $${i} OR se.equipment_name ILIKE $${i})`); p.push(`%${search}%`); i++; }
  const where = w.length ? 'WHERE '+w.join(' AND ') : '';
  const offset = (parseInt(page)-1)*parseInt(limit);

  // Dynamic Whitelisted Sorting
  const sortMap = {
    code: 'm.code',
    name: 'm.name',
    category: 'mc.name',
    categoryName: 'mc.name',
    section: 'ps.name',
    sectionName: 'ps.name',
    machine: 'mac.name',
    machineName: 'mac.name',
    criticality: 'm.criticality_class',
    criticalityClass: 'm.criticality_class',
    current_stock: 'm.current_stock',
    stock: 'm.current_stock',
    unit_price: 'm.unit_price',
    price: 'm.unit_price',
    valuation: '(m.current_stock * m.unit_price)',
    reorder_level: 'm.reorder_level',
    min_stock: 'm.min_stock',
    max_stock: 'm.max_stock',
    hsn_code: 'm.hsn_code',
    bin_location: 'm.bin_location',
    is_active: 'm.is_active',
    received: 'received',
    issued: 'issued'
  };
  const direction = String(sort_order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const orderExpr = sort_by && sortMap[sort_by]
    ? `${sortMap[sort_by]} ${direction} NULLS LAST, m.name ASC`
    : `m.criticality_class NULLS LAST, m.name ASC`;

  const { rows } = await pool.query(
    `SELECT m.id, m.code, m.name, m.uom, m.hsn_code,
            m.current_stock, m.reorder_level, m.min_stock, m.max_stock,
            m.reorder_buffer, m.unit_price, m.is_active,
            m.section_id           as "sectionId",
            m.machine_id           as "machineId",
            m.section_equipment_id as "sectionEquipmentId",
            ps.name                as "sectionName",
            ps.section_code        as "sectionCode",
            mac.name               as "machineName",
            mac.code               as "machineCode",
            se.equipment_name      as "equipmentName",
            se.tag_name            as "equipmentTagName",
            se.remarks             as "equipmentRemarks",
            m.section_context      as "sectionContext",
            m.criticality_class    as "criticalityClass",
            m.procurement_strategy as "procurementStrategy",
            m.oem_supplier         as "oemSupplier",
            m.last_audit_cycle     as "lastAuditCycle",
            m.calibration_protocol as "calibrationProtocol",
            m.bin_location         as "binLocation",
            m.is_serialized        as "isSerialized",
            m.expected_lifespan_days as "expectedLifespanDays",
            mc.name                as "categoryName",
            m.category_id          as "categoryId",
            COALESCE((SELECT COUNT(DISTINCT pi.po_id) FROM po_items pi WHERE pi.material_id = m.id), 0)::int AS "poCount",
            COALESCE((SELECT COUNT(DISTINCT pi.po_id) FROM po_items pi WHERE pi.material_id = m.id), 0)::int AS po_count,
            COALESCE((SELECT SUM(sl.in_qty)  FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS received,
            COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.date = CURRENT_DATE AND sl.transaction_type != 'opening'), 0) AS issued
     FROM materials m
     LEFT JOIN material_categories mc ON mc.id=m.category_id
     LEFT JOIN plant_sections ps ON ps.id = m.section_id
     LEFT JOIN machines mac ON mac.id = m.machine_id
     LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
     ${where} ORDER BY ${orderExpr}
     LIMIT $${i++} OFFSET $${i++}`,
    [...p, parseInt(limit), offset]);
  const { rows: cnt } = await pool.query(`
    SELECT COUNT(*)
    FROM materials m
    LEFT JOIN plant_sections ps ON ps.id = m.section_id
    LEFT JOIN machines mac ON mac.id = m.machine_id
    LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
    ${where}`, p);
  res.json({ success: true, data: rows, total: parseInt(cnt[0].count) });
}));

router.post('/materials', auth, requireLevel(1), ar(async (req, res) => {
  const { code, name, category_id, uom, hsn_code, reorder_level, min_stock, max_stock, unit_price, bin_location,
          reorder_buffer, section_context, criticality_class, procurement_strategy,
          oem_supplier, last_audit_cycle, calibration_protocol,
          is_serialized, expected_lifespan_days, is_active,
          section_id, machine_id, section_equipment_id,
          current_stock, balance, received, issued } = req.body;
  if (!code||!name||!category_id||!uom) return res.status(400).json({ success: false, message: 'code,name,category_id,uom required' });
  const stockVal = parseNum(balance) ?? parseNum(current_stock) ?? 0;
  const inQty = parseNum(received) ?? 0;
  const outQty = parseNum(issued) ?? 0;
  const price = parseNum(unit_price) ?? 0;
  const opQty = parseNum(req.body.opening) ?? parseFloat((stockVal - inQty + outQty).toFixed(3));
  const activeVal = is_active !== undefined ? Boolean(is_active) : true;
  const secId = parseNum(section_id);
  const mcnId = parseNum(machine_id);
  const secEqId = parseNum(section_equipment_id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO materials (code,name,category_id,uom,hsn_code,reorder_level,min_stock,max_stock,current_stock,unit_price,bin_location,
         reorder_buffer,section_context,criticality_class,procurement_strategy,oem_supplier,last_audit_cycle,calibration_protocol,
         is_serialized,expected_lifespan_days,is_active,section_id,machine_id,section_equipment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), parseInt(category_id), uom.trim(), hsn_code ? hsn_code.trim() : null,
       parseNum(reorder_level)??0, parseNum(min_stock)??0, parseNum(max_stock)??0,
       stockVal, price, bin_location ? bin_location.trim() : null,
       parseNum(reorder_buffer)??0, section_context||null, criticality_class ? criticality_class.trim().toUpperCase() : null,
       procurement_strategy||null, oem_supplier||null, last_audit_cycle||null, calibration_protocol||null,
       Boolean(is_serialized), parseNum(expected_lifespan_days)??365, activeVal, secId, mcnId, secEqId]
    );

    const matId = rows[0].id;
    // 1. Opening stock ledger record
    if (opQty > 0 || (stockVal > 0 && inQty === 0 && outQty === 0)) {
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
         VALUES ($1, CURRENT_DATE, 'opening', $2, 0, $2, $3, $4, 'Opening Stock / Master Entry', $5)`,
        [matId, opQty, price, opQty * price, req.user?.id || null]
      );
    }
    // 2. Initial Received ledger record (if specified on creation)
    if (inQty > 0) {
      const balAfterIn = opQty + inQty;
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
         VALUES ($1, CURRENT_DATE, 'grn', $2, 0, $3, $4, $5, 'Initial Receipt / Master Creation', $6)`,
        [matId, inQty, balAfterIn, price, inQty * price, req.user?.id || null]
      );
    }
    // 3. Initial Issued ledger record (if specified on creation)
    if (outQty > 0) {
      await client.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
         VALUES ($1, CURRENT_DATE, 'issue', 0, $2, $3, $4, $5, 'Initial Issue / Master Creation', $6)`,
        [matId, outQty, stockVal, price, outQty * price, req.user?.id || null]
      );
    }

    await client.query('COMMIT');

    publish(TOPICS.EVENTS_ALL, `material-${matId}`, { event: 'material.created', id: matId, code, name, stockVal, price, userId: req.user?.id });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// ── EXCEL TEMPLATE GENERATOR FOR STORE MANAGERS ─────────────────────────────
// MUST stay ABOVE `/materials/:id` — Express matches in registration order, so a literal
// path registered after a `:id` param route is unreachable (the id handler would receive
// id='excel-template' and blow up casting it to integer).
router.get('/materials/excel-template', auth, ar(async (req, res) => {
  const [catsRes, secRes, mcnRes, eqRes] = await Promise.all([
    pool.query(`
      SELECT mc.id, mc.name, mc.code, mc.type, p.name AS parent_name
      FROM material_categories mc
      LEFT JOIN material_categories p ON p.id = mc.parent_id
      ORDER BY p.name NULLS FIRST, mc.name ASC
    `),
    pool.query(`
      SELECT id, section_code, name FROM plant_sections WHERE is_active = true ORDER BY sort_order, name
    `),
    pool.query(`
      SELECT id, code, name FROM machines WHERE is_active = true ORDER BY name
    `),
    pool.query(`
      SELECT se.id, ps.name AS section_name, se.equipment_name, se.tag_name, se.remarks
      FROM section_equipment se
      LEFT JOIN plant_sections ps ON ps.id = se.section_id
      WHERE se.is_active = true ORDER BY ps.name, se.equipment_name
    `)
  ]);

  const wb = xlsx.utils.book_new();

  // Sheet 1: Template
  const templateData = [
    ['S.No', 'Material Code', 'Material Name / Full Specification', 'Category / Subcategory', 'Section Name', 'Machine / Equipment', 'Criticality Class (A/B/C)', 'HSN Code', 'Rack / Box No', 'Opening Stock', 'Received (+)', 'Issued (-)', 'Closing Balance', 'Unit Price (INR)', 'Status (Active/Inactive)'],
    [1, 'MV0002', '0.5" PISTON VALVES/ BELLOW SEAL GLOBE VALVE', 'Mechanical › Valve', 'Wire Section', 'Bottom Wire Couch Roll', 'A', '4802', 'Rack 2, Box 4', 12.001, 5.000, 0.000, 17.001, 100.00, 'Active'],
    [2, 'MSSS004', '1 1/2" S.S SOCKET', 'Mechanical › SS/MS Pipe Fitting', 'Press Section', '1st Press Top Roll', 'C', '7307 2900', 'Rack 1, Box 10', 9.000, 0.000, 0.000, 9.000, 150.00, 'Active'],
    [3, 'QC-001', 'LAB DIGITAL VISCOMETER SPINDLE #4', 'Quality Control', 'Lab', 'Lab Section', 'B', '9027 8090', 'Lab Cabinet 1', 2.000, 1.000, 0.000, 3.000, 4500.00, 'Active']
  ];
  const wsTemplate = xlsx.utils.aoa_to_sheet(templateData);
  xlsx.utils.book_append_sheet(wb, wsTemplate, 'Store_Material_Template');

  // Sheet 2: Categories Reference
  const catRefData = [
    ['Category ID', 'Category Name', 'Category Code', 'Parent Category', 'Type'],
    ...catsRes.rows.map(c => [c.id, c.name, c.code || '—', c.parent_name || 'Top-Level', c.type || 'Spare Part'])
  ];
  const wsCatRef = xlsx.utils.aoa_to_sheet(catRefData);
  xlsx.utils.book_append_sheet(wb, wsCatRef, 'Categories_Reference');

  // Sheet 3: Sections & Equipment Reference
  const secRefData = [
    ['Section Code', 'Section Name', 'Equipment / Roll Name', 'Tag Name', 'Specs / Bearing'],
    ...eqRes.rows.map(e => [e.section_name || '—', e.section_name || '—', e.equipment_name, e.tag_name, e.remarks || '—'])
  ];
  const wsSecRef = xlsx.utils.aoa_to_sheet(secRefData);
  xlsx.utils.book_append_sheet(wb, wsSecRef, 'Sections_Equipment_Reference');

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="MK_Paper_Mill_Store_Template.xlsx"');
  res.send(buf);
}));

// GET /api/master/materials/export/excel — Comprehensive multi-sheet up-to-date inventory Excel export
router.get('/materials/export/excel', auth, ar(async (req, res) => {
  const options = {
    store_type: req.query.store_type || 'all',
    category_id: req.query.category_id,
    stock_status: req.query.stock_status || 'all',
    criticality: req.query.criticality || 'all',
    section_id: req.query.section_id,
    machine_id: req.query.machine_id,
    search: req.query.search,
    include_category_sheets: req.query.include_category_sheets !== 'false',
    include_summary_sheet: req.query.include_summary_sheet !== 'false',
    include_reorder_sheet: req.query.include_reorder_sheet !== 'false',
    include_pricing: req.query.include_pricing !== 'false',
    include_technical: req.query.include_technical !== 'false',
    include_movement: req.query.include_movement !== 'false',
    target_date: req.query.target_date,
    user_name: req.user?.name || req.user?.email || 'Store Manager'
  };

  const result = await generateInventoryExcel(options);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('X-Meta-Total-SKUs', String(result.meta.totalSKUs));
  res.setHeader('X-Meta-Total-Valuation', String(result.meta.totalValuation));
  res.send(result.buffer);
}));

// GET /api/master/materials/:id — Get comprehensive material product details and stock summary
router.get('/materials/:id', auth, ar(async (req, res) => {
  const { rows: [mat] } = await pool.query(`
    SELECT m.*,
           mc.name AS category_name,
           mc.name AS "categoryName",
           mc.code AS category_code,
           mc.type AS category_type,
           m.section_id AS "sectionId",
           m.machine_id AS "machineId",
           m.section_equipment_id AS "sectionEquipmentId",
           ps.name AS "sectionName",
           ps.section_code AS "sectionCode",
           mac.name AS "machineName",
           mac.code AS "machineCode",
           se.equipment_name AS "equipmentName",
           se.tag_name AS "equipmentTagName",
           se.remarks AS "equipmentRemarks",
           (m.current_stock <= m.min_stock) AS "lowStock",
           (m.current_stock * m.unit_price) AS valuation
    FROM materials m
    LEFT JOIN material_categories mc ON m.category_id = mc.id
    LEFT JOIN plant_sections ps ON ps.id = m.section_id
    LEFT JOIN machines mac ON mac.id = m.machine_id
    LEFT JOIN section_equipment se ON se.id = m.section_equipment_id
    WHERE m.id = $1
  `, [req.params.id]);

  if (!mat) {
    return res.status(404).json({ success: false, message: 'Material product not found' });
  }

  // Fetch recent stock ledger transactions for this product
  const ledgerRes = await pool.query(`
    SELECT sl.*,
           u.name AS created_by_name
    FROM stock_ledger sl
    LEFT JOIN users u ON sl.created_by = u.id
    WHERE sl.material_id = $1
    ORDER BY sl.date DESC, sl.id DESC
    LIMIT 20
  `, [req.params.id]);

  // Aggregate stats
  // NOTE: must exclude only 'opening' (not whitelist specific type strings) — real write paths
  // across the app use many transaction_type values beyond 'grn'/'issue' (e.g. 'return',
  // 'return_to_vendor', 'transfer', 'cash_purchase', 'Adjustment', 'adjustment_plus', 'sale',
  // 'receipt', and capitalized 'Issue'). A whitelist here silently drops those from
  // received/issued, which then desyncs opening_stock = current_stock - today_received +
  // today_issued below. Matches the comprehensive `transaction_type != 'opening'` pattern used
  // by GET /materials and GET /materials/:id/stock-summary elsewhere in this file.
  const statsRes = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN transaction_type != 'opening' THEN in_qty ELSE 0 END), 0) AS total_received,
      COALESCE(SUM(CASE WHEN transaction_type != 'opening' THEN out_qty ELSE 0 END), 0) AS total_issued,
      COALESCE(SUM(CASE WHEN date = CURRENT_DATE AND transaction_type != 'opening' THEN in_qty ELSE 0 END), 0) AS today_received,
      COALESCE(SUM(CASE WHEN date = CURRENT_DATE AND transaction_type != 'opening' THEN out_qty ELSE 0 END), 0) AS today_issued
    FROM stock_ledger
    WHERE material_id = $1
  `, [req.params.id]);

  const todayRec = parseFloat(statsRes.rows[0]?.today_received || 0);
  const todayIss = parseFloat(statsRes.rows[0]?.today_issued || 0);
  const curStock = parseFloat(mat.current_stock || 0);
  const yesterdayClosing = parseFloat((curStock - todayRec + todayIss).toFixed(3));

  res.json({
    success: true,
    data: {
      ...mat,
      total_received: parseFloat(statsRes.rows[0]?.total_received || 0),
      total_issued: parseFloat(statsRes.rows[0]?.total_issued || 0),
      today_received: todayRec,
      today_issued: todayIss,
      opening_stock: yesterdayClosing,
      recent_transactions: ledgerRes.rows || []
    }
  });
}));

router.put('/materials/:id', auth, requireLevel(1), ar(async (req, res) => {
  const { code, name, category_id, uom, hsn_code, reorder_level, min_stock, max_stock,
          reorder_buffer, unit_price, is_active, bin_location,
          section_context, criticality_class, procurement_strategy,
          oem_supplier, last_audit_cycle, calibration_protocol,
          is_serialized, expected_lifespan_days,
          section_id, machine_id, section_equipment_id,
          current_stock, balance, received, issued, opening } = req.body;

  const stockVal = parseNum(balance) ?? parseNum(current_stock);
  const inQty = parseNum(received);
  const outQty = parseNum(issued);
  const opQty = parseNum(opening);
  const price = parseNum(unit_price) ?? 0;
  const secId = parseNum(section_id);
  const mcnId = parseNum(machine_id);
  const secEqId = parseNum(section_equipment_id);

  let updateQuery = `
    UPDATE materials SET
       code=$1, name=$2, category_id=$3, uom=$4,
       hsn_code=$5,
       reorder_level=$6, min_stock=$7, max_stock=$8,
       reorder_buffer=$9, unit_price=$10, is_active=$11,
       section_context=$12, criticality_class=$13,
       procurement_strategy=$14, oem_supplier=$15,
       last_audit_cycle=$16, calibration_protocol=$17,
       bin_location=$18, is_serialized=$19,
       expected_lifespan_days=$20,
       section_id=$21, machine_id=$22, section_equipment_id=$23
  `;
  const params = [
    code ? code.trim().toUpperCase() : null,
    name ? name.trim() : null,
    category_id ? parseInt(category_id) : null,
    uom ? uom.trim() : null,
    hsn_code ? hsn_code.trim() : null,
    parseNum(reorder_level)??0, parseNum(min_stock)??0, parseNum(max_stock)??0,
    parseNum(reorder_buffer)??0, price, Boolean(is_active !== undefined ? is_active : true),
    section_context||null, criticality_class ? criticality_class.trim().toUpperCase() : null,
    procurement_strategy||null, oem_supplier||null,
    last_audit_cycle||null, calibration_protocol||null,
    bin_location ? bin_location.trim() : null, Boolean(is_serialized),
    parseNum(expected_lifespan_days)??365,
    secId, mcnId, secEqId
  ];

  if (stockVal !== null && stockVal !== undefined) {
    params.push(stockVal);
    updateQuery += `, current_stock=$${params.length}`;
  }

  params.push(req.params.id);
  updateQuery += ` WHERE id=$${params.length}`;

  await pool.query(updateQuery, params);

  // Sync stock ledger entries (opening, received, issued) if provided
  if (stockVal !== null || inQty !== null || outQty !== null || opQty !== null) {
    const { rows: [sums] } = await pool.query(
      `SELECT COALESCE(SUM(in_qty), 0) AS received, COALESCE(SUM(out_qty), 0) AS issued
       FROM stock_ledger WHERE material_id = $1 AND transaction_type != 'opening'`,
      [req.params.id]
    );
    const existingRec = parseFloat(sums?.received || 0);
    const existingIss = parseFloat(sums?.issued || 0);

    let finalOp = opQty;
    let finalStock = stockVal;

    if (finalOp !== null && finalOp !== undefined) {
      // If opening is explicitly given, closing is opening + existing receipts - existing issues
      if (finalStock === null || finalStock === undefined) {
        finalStock = parseFloat((finalOp + existingRec - existingIss).toFixed(3));
      }
    } else if (finalStock !== null && finalStock !== undefined) {
      // If closing is given, opening is closing - receipts + issues
      finalOp = parseFloat((finalStock - existingRec + existingIss).toFixed(3));
    } else {
      finalOp = parseFloat(((stockVal ?? 0) - existingRec + existingIss).toFixed(3));
      finalStock = stockVal ?? 0;
    }

    // Update current_stock in materials table to reflect exact closing balance
    await pool.query('UPDATE materials SET current_stock = $1 WHERE id = $2', [finalStock, req.params.id]);

    // 1. Maintain clean Opening balance in stock_ledger
    const { rows: existOp } = await pool.query(
      `SELECT id FROM stock_ledger WHERE material_id=$1 AND transaction_type='opening'`,
      [req.params.id]
    );
    if (existOp.length) {
      await pool.query(
        `UPDATE stock_ledger SET in_qty=$1, out_qty=0, balance=$1, unit_price=$2, value=$3, date=CURRENT_DATE WHERE id=$4`,
        [finalOp, price, finalOp * price, existOp[0].id]
      );
    } else if (finalOp > 0 || finalStock > 0) {
      await pool.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
         VALUES ($1, CURRENT_DATE, 'opening', $2, 0, $2, $3, $4, 'Opening Stock / Master Entry', $5)`,
        [req.params.id, finalOp, price, finalOp * price, req.user?.id || null]
      );
    }

    // 2. If this material has zero non-opening receipts and an initial received quantity was specified in modal, log initial receipt
    if (inQty !== null && inQty > 0 && existingRec === 0) {
      await pool.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
         VALUES ($1, CURRENT_DATE, 'grn', $2, 0, $3, $4, $5, 'Material Receipt / Master Entry', $6)`,
        [req.params.id, inQty, finalOp + inQty, price, inQty * price, req.user?.id || null]
      );
    }

    // 3. If this material has zero non-opening issues and an initial issue quantity was specified in modal, log initial issue
    if (outQty !== null && outQty > 0 && existingIss === 0) {
      await pool.query(
        `INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by)
         VALUES ($1, CURRENT_DATE, 'issue', 0, $2, $3, $4, $5, 'Material Issue / Master Entry', $6)`,
        [req.params.id, outQty, finalStock, price, outQty * price, req.user?.id || null]
      );
    }
  }

  // Fetch updated full row for instant frontend reflection
  const { rows: [updated] } = await pool.query(`
    SELECT m.id, m.code, m.name, m.uom, m.hsn_code,
           m.current_stock, m.reorder_level, m.min_stock, m.max_stock,
           m.reorder_buffer, m.unit_price, m.is_active,
           m.section_context      as "sectionContext",
           m.criticality_class    as "criticalityClass",
           m.procurement_strategy as "procurementStrategy",
           m.oem_supplier         as "oemSupplier",
           m.last_audit_cycle     as "lastAuditCycle",
           m.calibration_protocol as "calibrationProtocol",
           m.bin_location         as "binLocation",
           m.is_serialized        as "isSerialized",
           m.expected_lifespan_days as "expectedLifespanDays",
           mc.name                as "categoryName",
           m.category_id          as "categoryId",
           COALESCE((SELECT SUM(sl.in_qty)  FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS received,
           COALESCE((SELECT SUM(sl.out_qty) FROM stock_ledger sl WHERE sl.material_id = m.id AND sl.transaction_type != 'opening'), 0) AS issued
    FROM materials m
    LEFT JOIN material_categories mc ON mc.id=m.category_id
    WHERE m.id = $1
  `, [req.params.id]);

  res.json({ success: true, data: updated });
}));

// Soft-delete: marks material as inactive instead of hard-deleting (stock history preserved).
// Level 3 matches every other master-data soft delete in this file (vendors, customers, sections)
// and matches PUT /materials/:id/restore, which is also requireLevel(3).
router.delete('/materials/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { rows } = await pool.query('UPDATE materials SET is_active=false, deleted_by=$2 WHERE id=$1 RETURNING id', [req.params.id, req.user?.id || null]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Material not found' });
  res.json({ success: true });
}));

// Read-only stock movement summary — BALANCE/RECEIVED/ISSUE/OPENING for the Add/Edit item form.
// Computed live from stock_ledger, never hardcoded.
router.get('/materials/:id/stock-summary', auth, ar(async (req, res) => {
  const { rows: [mat] } = await pool.query('SELECT current_stock FROM materials WHERE id=$1', [req.params.id]);
  if (!mat) return res.json({ success: false, message: 'Not found' });
  const targetDate = req.query.date ? req.query.date : null;
  const dateClause = targetDate ? 'AND date = $2' : 'AND date = CURRENT_DATE';
  const queryParams = targetDate ? [req.params.id, targetDate] : [req.params.id];
  const { rows: [sums] } = await pool.query(
    `SELECT COALESCE(SUM(in_qty),0) AS received, COALESCE(SUM(out_qty),0) AS issued
     FROM stock_ledger WHERE material_id=$1 AND transaction_type != 'opening' ${dateClause}`, queryParams
  );
  const cur = parseFloat(mat.current_stock || 0);
  const rec = parseFloat(sums.received || 0);
  const iss = parseFloat(sums.issued || 0);
  const op = parseFloat((cur - rec + iss).toFixed(3));
  res.json({ success: true, data: { balance: cur, received: rec, issued: iss, opening: op } });
}));

// Re-sync materials.name/hsn_code/bin_location for the 17 Mechanical subcategories from
// Projects_Requirement/8152026/MECHANICAL STORE AUGUST-2026.xlsx.
router.post('/materials/sync-mechanical', auth, requireLevel(1), ar(async (req, res) => {
  const dryRun = !!(req.body && req.body.dryRun);
  try {
    const { results, totals } = await runMechImport(DEFAULT_MECH_FILE, dryRun);
    res.json({ success: true, data: { results, totals } });
  } catch (e) {
    if (e.code === 'FILE_NOT_FOUND') {
      return res.status(400).json({ success: false, message: `Mechanical store excel not found at ${DEFAULT_MECH_FILE}. Place the updated file there and retry.` });
    }
    throw e;
  }
}));

// Re-sync electrical materials for the 5 Electrical subcategories from
// Projects_Requirement/8152026/ELECTRICAL STORES AUGUST-2026.xlsx.
router.post('/materials/sync-electrical', auth, requireLevel(1), ar(async (req, res) => {
  const dryRun = !!(req.body && req.body.dryRun);
  try {
    const { results, totals } = await runElecImport(DEFAULT_ELEC_FILE, dryRun);
    res.json({ success: true, data: { results, totals } });
  } catch (e) {
    if (e.code === 'FILE_NOT_FOUND') {
      return res.status(400).json({ success: false, message: `Electrical store excel not found at ${DEFAULT_ELEC_FILE}. Place the updated file there and retry.` });
    }
    throw e;
  }
}));

// Re-sync all stores from Projects_Requirement/8152026 Excel directory
router.post('/materials/sync-all-stores', auth, requireLevel(1), ar(async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const backendRoot = path.resolve(__dirname, '../..');
    const out = execSync('node scripts/import_all_stores_8152026.js', { cwd: backendRoot, encoding: 'utf8' });
    res.json({ success: true, message: 'All store Excels synchronized successfully from 8152026', output: out });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
}));

// ── UNIVERSAL STORE EXCEL UPLOAD & PREVIEW/SYNC ENGINE ───────────────────────
const CATEGORY_ALIASES = {
  'ele general': 'ELEC-GEN',
  'eleg': 'ELEC-GEN',
  'electrical general': 'ELEC-GEN',
  'elec-gen': 'ELEC-GEN',
  'mcb': 'ELEC-MCB',
  'mcb & fuses': 'ELEC-MCB',
  'fuses': 'ELEC-MCB',
  'fuse': 'ELEC-MCB',
  'elec-mcb': 'ELEC-MCB',
  'vfd': 'ELEC-VFD',
  'vfd drive': 'ELEC-VFD',
  'vfd drives': 'ELEC-VFD',
  'vfd drive & spares': 'ELEC-VFD',
  'elec-vfd': 'ELEC-VFD',
  'contactor': 'ELEC-CNT',
  'contactors': 'ELEC-CNT',
  'relay': 'ELEC-RLY',
  'relays': 'ELEC-RLY',
  'bearing': 'MECH-BRG',
  'bearings': 'MECH-BRG',
  'valve': 'MECH-VLV',
  'valves': 'MECH-VLV',
  'oil seal': 'MECH-OSL',
  'oil seals': 'MECH-OSL',
  'v-belt': 'MECH-VBT',
  'v-belts': 'MECH-VBT',
  'v belt': 'MECH-VBT',
  'welding rods': 'MECH-WLD',
  'welding rod': 'MECH-WLD',
  'pump sleeve': 'MECH-PSL',
  'pump sleeves': 'MECH-PSL',
  'tyre coupling': 'MECH-TCP',
  'tyre coupling & pin bush': 'MECH-TCP',
  'pipe fitting': 'MECH-PIP',
  'ss/ms pipe fitting': 'MECH-PIP',
  'gauges': 'MECH-GUG',
  'gauge': 'MECH-GUG',
  'nozzles': 'MECH-NOZ',
  'nozzle': 'MECH-NOZ',
  'pulley': 'MECH-PUL',
  'pulleys': 'MECH-PUL',
  'bolts & nuts': 'MECH-BNW',
  'bolts & nuts/washers': 'MECH-BNW',
  'compressor': 'MECH-CMP',
  'blade': 'MECH-BLD',
  'blade/cutting wheel & grinding': 'MECH-BLD',
  'shaft & impeller': 'MECH-SFT',
  'shaft': 'MECH-SFT',
  'impeller': 'MECH-SFT',
  'lubricants': 'MECH-LUB',
  'check nut & washer': 'MECH-CNW',
  'clothing': 'CLOTH',
  'chemical': 'CHEM',
  'chemicals': 'CHEM',
  'waste paper': 'WASTE',
  'wood pulp': 'PULP',
  'stationary': 'STAT',
  'packing': 'PACK',
  'general': 'GEN',
  'general store': 'GEN',
  'hydraulic & pneumatic': 'HYDPNEU',
  'hydraulic': 'HYDPNEU',
  'pneumatic': 'HYDPNEU'
};

async function resolveCategory(clientOrPool, catStr, targetCatId) {
  if (targetCatId && !isNaN(parseInt(targetCatId))) {
    const { rows: [tCat] } = await clientOrPool.query('SELECT id FROM material_categories WHERE id=$1', [parseInt(targetCatId)]);
    if (tCat) return tCat.id;
  }
  if (!catStr) {
    const { rows: [gen] } = await clientOrPool.query("SELECT id FROM material_categories WHERE code='GEN' OR name ILIKE '%general%' ORDER BY id ASC LIMIT 1");
    return gen?.id || 35;
  }

  const norm = String(catStr).toLowerCase().trim();
  const aliasCode = CATEGORY_ALIASES[norm] || CATEGORY_ALIASES[norm.replace(/[_\-]/g, ' ')];
  if (aliasCode) {
    const { rows: [byCode] } = await clientOrPool.query('SELECT id FROM material_categories WHERE code = $1 LIMIT 1', [aliasCode]);
    if (byCode) return byCode.id;
  }

  const catClean = catStr.replace('›', '/').split('/')[0].trim();
  const subClean = catStr.includes('›') || catStr.includes('/') ? catStr.split(/[›\/]/).pop().trim() : null;

  const { rows: [catRow] } = await clientOrPool.query(
    `SELECT id FROM material_categories WHERE name ILIKE $1 OR code ILIKE $1 LIMIT 1`,
    [subClean || catClean]
  );
  if (catRow) return catRow.id;

  const { rows: [fuzzyRow] } = await clientOrPool.query(
    `SELECT id FROM material_categories WHERE name ILIKE $1 LIMIT 1`,
    [`%${subClean || catClean}%`]
  );
  if (fuzzyRow) return fuzzyRow.id;

  const { rows: [genRow] } = await clientOrPool.query("SELECT id FROM material_categories WHERE code='GEN' OR name ILIKE '%general%' ORDER BY id ASC LIMIT 1");
  return genRow?.id || 35;
}

router.post('/materials/upload-excel', auth, requireLevel(1), upload.single('file'), ar(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, message: 'No Excel file uploaded. Please provide a .xlsx or .xls file.' });
  }

  const isPreview = req.query.preview === 'true' || (req.body && req.body.preview === 'true');
  const targetCatId = req.body?.target_category_id || req.query?.target_category_id || null;
  const wb = xlsx.read(req.file.buffer, { type: 'buffer' });

  // 1. Parse all sheets
  const allParsed = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawRows.length) continue;

    // Detect header row & columns
    let headerIdx = -1;
    let colMap = {};
    for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
      const row = rawRows[r].map(c => String(c).trim().toLowerCase());
      const hasCodeOrName = row.some(c => c.includes('code') || c.includes('particular') || c.includes('name') || c.includes('item') || c.includes('description') || c.includes('size'));
      if (hasCodeOrName) {
        headerIdx = r;
        row.forEach((h, colI) => {
          if (!h) return;
          if (h.includes('code') || h === 'item code' || h === 'mat code' || h === 'part no' || h === 'part code') colMap.code = colI;
          else if (h.includes('particular') || h.includes('name') || h.includes('description') || h.includes('item') || h.includes('spec') || h.includes('size')) {
            if (colMap.name === undefined) colMap.name = colI;
          }
          else if (h.includes('section')) colMap.section = colI;
          else if (h.includes('machine') || h.includes('equipment') || h.includes('mcn') || h.includes('roll')) colMap.machine = colI;
          else if (h.includes('cat') || h.includes('group') || h.includes('dept')) colMap.category = colI;
          else if (h.includes('crit') || h.includes('class')) colMap.crit = colI;
          else if (h.includes('hsn') || h.includes('sac')) colMap.hsn = colI;
          else if (h.includes('rack') || h.includes('box') || h.includes('bin') || h.includes('loc')) colMap.bin = colI;
          else if (h.includes('opening') || h.includes('op stock') || h.includes('op bal')) colMap.opening = colI;
          else if (h.includes('rec') || h.includes('inward') || h.includes('grn') || h.includes('in qty')) colMap.received = colI;
          else if (h.includes('iss') || h.includes('outward') || h.includes('issue') || h.includes('out qty')) colMap.issued = colI;
          else if (h.includes('bal') || h.includes('closing') || h.includes('phy') || h.includes('current stock') || h === 'stock' || h === 'qty') colMap.balance = colI;
          else if (h.includes('price') || h.includes('rate') || h.includes('unit price') || h.includes('cost')) colMap.price = colI;
          else if (h.includes('uom') || h.includes('unit')) colMap.uom = colI;
          else if (h.includes('status') || h.includes('active')) colMap.status = colI;
        });
        break;
      }
    }

    const dataRows = headerIdx !== -1 ? rawRows.slice(headerIdx + 1) : rawRows;
    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      if (!row || !row.some(cell => String(cell).trim().length > 0)) continue;

      let code = colMap.code !== undefined ? String(row[colMap.code] || '').trim().toUpperCase() : '';
      let name = colMap.name !== undefined ? String(row[colMap.name] || '').trim() : '';
      let category = colMap.category !== undefined ? String(row[colMap.category] || '').trim() : '';
      let section = colMap.section !== undefined ? String(row[colMap.section] || '').trim() : '';
      let machine = colMap.machine !== undefined ? String(row[colMap.machine] || '').trim() : '';
      let crit = colMap.crit !== undefined ? String(row[colMap.crit] || '').trim().toUpperCase() : '';
      let hsn = colMap.hsn !== undefined ? String(row[colMap.hsn] || '').trim() : '';
      let bin = colMap.bin !== undefined ? String(row[colMap.bin] || '').trim() : '';
      let uom = colMap.uom !== undefined ? String(row[colMap.uom] || '').trim().toUpperCase() : 'NOS';
      let status = colMap.status !== undefined ? String(row[colMap.status] || '').trim().toLowerCase() : 'active';

      let opening = colMap.opening !== undefined ? parseNum(row[colMap.opening]) : null;
      let received = colMap.received !== undefined ? parseNum(row[colMap.received]) : 0;
      let issued = colMap.issued !== undefined ? parseNum(row[colMap.issued]) : 0;
      let balance = colMap.balance !== undefined ? parseNum(row[colMap.balance]) : null;
      let price = colMap.price !== undefined ? parseNum(row[colMap.price]) : 0;

      // Fallback heuristics
      if (!code && !name) {
        const strCells = row.map((c, i) => ({ val: String(c).trim(), idx: i })).filter(x => x.val.length > 1);
        if (strCells.length >= 1) name = strCells[0].val;
        if (strCells.length >= 2 && strCells[0].val.length <= 12) {
          code = strCells[0].val.toUpperCase();
          name = strCells[1].val;
        }
      }

      if (!name && code) name = `${sheetName} ${code}`;
      if (!name) continue;

      if (!category) {
        category = sheetName.replace(/[0-9_\-]/g, ' ').trim() || 'General Store';
      }

      if (balance === null && opening !== null) balance = parseFloat((opening + received - issued).toFixed(3));
      else if (balance !== null && opening === null) opening = parseFloat((balance - received + issued).toFixed(3));
      else if (balance === null && opening === null) { opening = 0; balance = 0; }

      allParsed.push({
        code: code || `GEN-${String(allParsed.length + 1).padStart(4, '0')}`,
        name,
        category,
        section,
        machine,
        sheetName,
        crit: ['A', 'B', 'C'].includes(crit) ? crit : null,
        hsn: hsn || null,
        bin: bin || null,
        uom: uom || 'NOS',
        opening: opening ?? 0,
        received: received ?? 0,
        issued: issued ?? 0,
        balance: balance ?? 0,
        unit_price: price ?? 0,
        is_active: status !== 'inactive' && status !== 'false' && status !== '0'
      });
    }
  }

  if (!allParsed.length) {
    return res.status(400).json({ success: false, message: 'No valid data rows could be extracted from the uploaded Excel file.' });
  }

  // 2. If PREVIEW mode: check database matches without saving
  if (isPreview) {
    const previewResults = [];
    let newItems = 0;
    let updateItems = 0;
    let totalVal = 0;

    for (const item of allParsed) {
      const resolvedCatId = await resolveCategory(pool, item.category, targetCatId);
      const { rows: exist } = await pool.query(
        `SELECT id, code, name, current_stock, unit_price FROM materials WHERE code = $1 OR name = $2 LIMIT 1`,
        [item.code, item.name]
      );
      const isExisting = exist.length > 0;
      if (isExisting) updateItems++; else newItems++;
      totalVal += (item.balance * item.unit_price);

      previewResults.push({
        code: item.code,
        name: item.name,
        category: item.category,
        resolvedCatId: (typeof resolvedCatId !== 'undefined' ? resolvedCatId : null),
        section: item.section || '—',
        machine: item.machine || '—',
        uom: item.uom,
        hsn_code: item.hsn,
        bin_location: item.bin,
        opening: item.opening,
        received: item.received,
        issued: item.issued,
        balance: item.balance,
        unit_price: item.unit_price,
        stock_value: (item.balance * item.unit_price).toFixed(2),
        criticality_class: item.crit,
        status: item.is_active ? 'Active' : 'Inactive',
        isExisting,
        currentStockInDb: isExisting ? exist[0].current_stock : null,
        action: isExisting ? 'Update' : 'Create'
      });
    }

    return res.json({
      success: true,
      preview: true,
      filename: req.file.originalname,
      targetCategoryId: targetCatId,
      totalRows: allParsed.length,
      newItemsCount: newItems,
      updateItemsCount: updateItems,
      totalValuation: totalVal,
      sheetsFound: wb.SheetNames,
      rows: previewResults.slice(0, 100), // top 100 for UI preview
      hasMore: previewResults.length > 100
    });
  }

  // 3. If COMMIT mode: transactional database upsert
  const client = await pool.connect();
  let createdCount = 0;
  let updatedCount = 0;
  let totalValuation = 0;

  try {
    await client.query('BEGIN');

    for (const item of allParsed) {
      let catId = (typeof resolveCategory === 'function') ? await resolveCategory(client, item.category, targetCatId) : null;
      if (!catId) {
        const catClean = item.category.replace('›', '/').split('/')[0].trim();
        const subClean = item.category.includes('›') || item.category.includes('/') ? item.category.split(/[›\/]/).pop().trim() : null;

        let { rows: [catRow] } = await client.query(
          `SELECT id FROM material_categories WHERE name ILIKE $1 OR code ILIKE $1 LIMIT 1`,
          [subClean || catClean]
        );
        if (!catRow) {
          let parentId = null;
          if (subClean) {
            const { rows: [pRow] } = await client.query(`SELECT id FROM material_categories WHERE name ILIKE $1 LIMIT 1`, [catClean]);
            if (pRow) parentId = pRow.id;
          }
          const { rows: [newCat] } = await client.query(
            `INSERT INTO material_categories (name, code, type, parent_id)
             VALUES ($1, $2, 'Spare Part', $3) RETURNING id`,
            [subClean || catClean, `CAT-${String(Date.now()).slice(-4)}`, parentId]
          );
          catId = newCat.id;
        } else {
          catId = catRow.id;
        }
      }

      // Match Section and Machine / Equipment
      let sectionId = null;
      let machineId = null;
      let sectionEquipmentId = null;
      let sectionContext = null;

      if (item.section) {
        const { rows: [secRow] } = await client.query(
          `SELECT id, name FROM plant_sections WHERE name ILIKE $1 OR section_code ILIKE $1 LIMIT 1`,
          [item.section.trim()]
        );
        if (secRow) {
          sectionId = secRow.id;
          sectionContext = secRow.name;
        }
      }

      if (item.machine) {
        // Try match section_equipment first
        const { rows: [eqRow] } = await client.query(
          `SELECT id, section_id, machine_id, equipment_name FROM section_equipment WHERE equipment_name ILIKE $1 OR tag_name ILIKE $1 LIMIT 1`,
          [item.machine.trim()]
        );
        if (eqRow) {
          sectionEquipmentId = eqRow.id;
          if (!sectionId && eqRow.section_id) sectionId = eqRow.section_id;
          if (eqRow.machine_id) machineId = eqRow.machine_id;
          sectionContext = sectionContext ? `${sectionContext} › ${eqRow.equipment_name}` : eqRow.equipment_name;
        } else {
          // Try match machine
          const { rows: [mcnRow] } = await client.query(
            `SELECT id, name FROM machines WHERE name ILIKE $1 OR code ILIKE $1 LIMIT 1`,
            [item.machine.trim()]
          );
          if (mcnRow) {
            machineId = mcnRow.id;
            sectionContext = sectionContext ? `${sectionContext} › ${mcnRow.name}` : mcnRow.name;
          }
        }
      }
      totalValuation += (item.balance * item.unit_price);

      // Check if material exists
      const { rows: [existMat] } = await client.query(
        `SELECT id FROM materials WHERE code = $1 OR name = $2 LIMIT 1`,
        [item.code, item.name]
      );

      let matId;
      if (existMat) {
        matId = existMat.id;
        updatedCount++;
        await client.query(
          `UPDATE materials SET
             category_id = COALESCE($1, category_id),
             hsn_code = COALESCE(NULLIF($2, ''), hsn_code),
             bin_location = COALESCE(NULLIF($3, ''), bin_location),
             uom = COALESCE(NULLIF($4, ''), uom),
             current_stock = $5,
             unit_price = $6,
             criticality_class = COALESCE(NULLIF($7, ''), criticality_class),
             is_active = $8,
             section_id = COALESCE($9, section_id),
             machine_id = COALESCE($10, machine_id),
             section_equipment_id = COALESCE($11, section_equipment_id),
             section_context = COALESCE(NULLIF($12, ''), section_context)
           WHERE id = $13`,
          [catId, item.hsn, item.bin, item.uom, item.balance, item.unit_price, item.crit, item.is_active, sectionId, machineId, sectionEquipmentId, sectionContext, matId]
        );
      } else {
        createdCount++;
        const { rows: [newM] } = await client.query(
          `INSERT INTO materials (code, name, category_id, uom, hsn_code, bin_location, current_stock, unit_price, criticality_class, is_active, reorder_level, min_stock)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 2, 1) RETURNING id`,
          [item.code, item.name, catId, item.uom, item.hsn, item.bin, item.balance, item.unit_price, item.crit, item.is_active]
        );
        matId = newM.id;
      }

      // Stock Ledger synchronization
      const { rows: existOp } = await client.query(`SELECT id FROM stock_ledger WHERE material_id=$1 AND transaction_type='opening'`, [matId]);
      if (existOp.length) {
        await client.query(`UPDATE stock_ledger SET in_qty=$1, balance=$1, unit_price=$2, value=$3 WHERE id=$4`, [item.opening, item.unit_price, item.opening * item.unit_price, existOp[0].id]);
      } else if (item.opening > 0 || item.balance > 0) {
        await client.query(`INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by) VALUES ($1, CURRENT_DATE, 'opening', $2, 0, $2, $3, $4, 'Excel Sync Opening', $5)`, [matId, item.opening, item.unit_price, item.opening * item.unit_price, req.user?.id || null]);
      }

      if (item.received > 0) {
        const { rows: existIn } = await client.query(`SELECT id FROM stock_ledger WHERE material_id=$1 AND transaction_type IN ('grn', 'in') LIMIT 1`, [matId]);
        if (existIn.length) {
          await client.query(`UPDATE stock_ledger SET in_qty=$1, unit_price=$2, value=$3 WHERE id=$4`, [item.received, item.unit_price, item.received * item.unit_price, existIn[0].id]);
        } else {
          await client.query(`INSERT INTO stock_ledger (material_id, date, transaction_type, in_qty, out_qty, balance, unit_price, value, remarks, created_by) VALUES ($1, CURRENT_DATE, 'grn', $2, 0, $3, $4, $5, 'Excel Sync Received', $6)`, [matId, item.received, item.opening + item.received, item.unit_price, item.received * item.unit_price, req.user?.id || null]);
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Successfully synchronized ${allParsed.length} materials from Excel!`,
      totalProcessed: allParsed.length,
      createdCount,
      updatedCount,
      totalValuation
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// ── VENDORS ──────────────────────────────────────────────────────────────────
// Schema: id, code, name, gstin, pan, address, city, state, pincode, contact_person, mobile, email, payment_terms, credit_days, rating, is_active
router.get('/warehouses', auth, ar(async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name, code FROM warehouses WHERE is_active=true ORDER BY name`);
  res.json({ success: true, data: rows });
}));

router.get('/vendors', auth, ar(async (req, res) => {
  const { is_active, search, page=1, limit=50 } = req.query;
  const filters = { search, limit: parseInt(limit), offset: (parseInt(page)-1)*parseInt(limit) };
  if (is_active !== undefined) filters.is_active = is_active === 'true';
  const rows = await getVendors(filters);
  const total = await countVendors({ is_active: filters.is_active, search });
  res.json({ success: true, data: rows, total });
}));

router.get('/vendors/:id', auth, ar(async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM vendors WHERE id=$1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Vendor not found' });
  res.json({ success: true, data: rows[0] });
}));

router.post('/vendors', auth, requireLevel(3), ar(async (req, res) => {
  const {
    name, gstin, pan, address, city, state, pincode,
    contact_person, mobile, email, payment_terms, credit_days, rating,
    bank_name, account_number, ifsc_code, branch_name, account_holder_name, account_type
  } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'name required' });
  const { rows: c } = await pool.query('SELECT COUNT(*) FROM vendors');
  const code = `VND-${String(parseInt(c[0].count)+1).padStart(4,'0')}`;
  const { rows } = await pool.query(
    `INSERT INTO vendors (
       code, name, gstin, pan, address, city, state, pincode,
       contact_person, mobile, email, payment_terms, credit_days, rating,
       bank_name, account_number, ifsc_code, branch_name, account_holder_name, account_type
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
    [
      code, name, gstin, pan, address, city, state, pincode,
      contact_person, mobile, email, payment_terms || '30 days', credit_days || 30, rating || 3,
      bank_name || null, account_number || null, ifsc_code || null, branch_name || null,
      account_holder_name || null, account_type || 'Current'
    ]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/vendors/:id', auth, requireLevel(3), ar(async (req, res) => {
  const {
    name, gstin, pan, address, city, state, pincode,
    contact_person, mobile, email, payment_terms, credit_days, rating, is_active,
    bank_name, account_number, ifsc_code, branch_name, account_holder_name, account_type
  } = req.body;
  await pool.query(
    `UPDATE vendors SET
       name=COALESCE($1,name), gstin=COALESCE($2,gstin), pan=COALESCE($3,pan), address=COALESCE($4,address),
       city=COALESCE($5,city), state=COALESCE($6,state), pincode=COALESCE($7,pincode),
       contact_person=COALESCE($8,contact_person), mobile=COALESCE($9,mobile), email=COALESCE($10,email),
       payment_terms=COALESCE($11,payment_terms), credit_days=COALESCE($12,credit_days), rating=COALESCE($13,rating),
       is_active=COALESCE($14,is_active), bank_name=COALESCE($15,bank_name), account_number=COALESCE($16,account_number),
       ifsc_code=COALESCE($17,ifsc_code), branch_name=COALESCE($18,branch_name),
       account_holder_name=COALESCE($19,account_holder_name), account_type=COALESCE($20,account_type)
     WHERE id=$21`,
    [
      name, gstin, pan, address, city, state, pincode,
      contact_person, mobile, email, payment_terms, credit_days, rating, is_active,
      bank_name, account_number, ifsc_code, branch_name, account_holder_name, account_type,
      req.params.id
    ]
  );
  res.json({ success: true });
}));

// Sync new vendors from Projects_Requirement/8202026/VENDER NAME.xlsx. The sheet only carries
// vendor names (no GSTIN/address/bank data), so this only ever INSERTs brand-new vendor rows
// (matched by normalized name / GSTIN when present) with the same defaults the Add Vendor form
// uses — it never updates or deletes an existing vendor. dryRun defaults true so a preview is
// always the safe default; pass { dryRun: false } to actually write.
router.post('/vendors/sync-excel', auth, requireLevel(3), ar(async (req, res) => {
  const dryRun = !(req.body && req.body.dryRun === false);
  try {
    const result = await runVendorImport(DEFAULT_VENDOR_FILE, dryRun);
    res.json({ success: true, data: result });
  } catch (e) {
    if (e.code === 'FILE_NOT_FOUND') {
      return res.status(400).json({ success: false, message: `Vendor excel not found at ${DEFAULT_VENDOR_FILE}. Place the updated file there and retry.` });
    }
    throw e;
  }
}));

// ── CUSTOMERS ────────────────────────────────────────────────────────────────
// Schema: id, code, name, gstin, pan, address, city, state, pincode, contact_person, mobile, email, credit_limit, credit_days, is_active
router.get('/customers', auth, ar(async (req, res) => {
  const { is_active, search, page=1, limit=50 } = req.query;
  const w=[]; const p=[]; let i=1;
  if (is_active !== undefined) { w.push(`is_active=$${i++}`); p.push(is_active==='true'); }
  if (search) { w.push(`(name ILIKE $${i} OR code ILIKE $${i} OR gstin ILIKE $${i})`); p.push(`%${search}%`); i++; }
  const where = w.length ? 'WHERE '+w.join(' AND ') : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(`SELECT * FROM customers ${where} ORDER BY name LIMIT $${i++} OFFSET $${i++}`, [...p,limit,offset]);
  const { rows: cnt } = await pool.query(`SELECT COUNT(*) FROM customers ${where}`, p);
  res.json({ success: true, data: rows, total: parseInt(cnt[0].count) });
}));

router.post('/customers', auth, requireLevel(3), ar(async (req, res) => {
  const { name, gstin, pan, address, city, state, pincode, contact_person, mobile, email, credit_limit, credit_days } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'name required' });
  const { rows: c } = await pool.query('SELECT COUNT(*) FROM customers');
  const code = `CST-${String(parseInt(c[0].count)+1).padStart(4,'0')}`;
  const { rows } = await pool.query(
    `INSERT INTO customers (code,name,gstin,pan,address,city,state,pincode,contact_person,mobile,email,credit_limit,credit_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [code,name,gstin,pan,address,city,state,pincode,contact_person,mobile,email,credit_limit||0,credit_days||30]);
  publish(TOPICS.EVENTS_ALL, `customer-${rows[0].id}`, { event: 'customer.created', id: rows[0].id, code, name, gstin, userId: req.user.id, timestamp: new Date() });
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/customers/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { name, gstin, pan, address, city, state, pincode, contact_person, mobile, email, credit_limit, credit_days, is_active } = req.body;
  await pool.query(
    `UPDATE customers SET name=$1,gstin=$2,pan=$3,address=$4,city=$5,state=$6,pincode=$7,
     contact_person=$8,mobile=$9,email=$10,credit_limit=$11,credit_days=$12,is_active=$13 WHERE id=$14`,
    [name,gstin,pan,address,city,state,pincode,contact_person,mobile,email,credit_limit,credit_days,is_active,req.params.id]);
  publish(TOPICS.EVENTS_ALL, `customer-${req.params.id}`, { event: 'customer.updated', id: req.params.id, name, gstin, userId: req.user.id, timestamp: new Date() });
  res.json({ success: true });
}));

// ── SOFT DELETE (is_active = false) ──────────────────────────────────────────
router.delete('/machines/:id', auth, requireLevel(4), ar(async (req, res) => {
  await pool.query('UPDATE machines SET is_active=false, deleted_by=$1 WHERE id=$2', [req.user.id, req.params.id]);
  res.json({ success: true });
}));

router.delete('/grades/:id', auth, requireLevel(4), ar(async (req, res) => {
  await pool.query('UPDATE grades SET is_active=false, deleted_by=$1 WHERE id=$2', [req.user.id, req.params.id]);
  res.json({ success: true });
}));

// NOTE: DELETE /materials/:id lives with the other material routes above (requireLevel(3),
// returns 404 when no row matches). A duplicate definition used to sit here — it was dead code,
// because Express matches in registration order, and it silently documented a different tier.

router.delete('/vendors/:id', auth, requireLevel(3), ar(async (req, res) => {
  await pool.query('UPDATE vendors SET is_active=false, deleted_by=$1 WHERE id=$2', [req.user.id, req.params.id]);
  res.json({ success: true });
}));

router.delete('/customers/:id', auth, requireLevel(3), ar(async (req, res) => {
  await pool.query('UPDATE customers SET is_active=false, deleted_by=$1 WHERE id=$2', [req.user.id, req.params.id]);
  publish(TOPICS.EVENTS_ALL, `customer-${req.params.id}`, { event: 'customer.deleted', id: req.params.id, userId: req.user.id, timestamp: new Date() });
  res.json({ success: true });
}));

router.delete('/categories/:id', auth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query('SELECT COUNT(*) FROM materials WHERE category_id=$1', [req.params.id]);
  if (parseInt(rows[0].count) > 0) return res.status(400).json({ success: false, message: 'Category in use by materials — cannot delete' });
  await pool.query('DELETE FROM material_categories WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

// ── RESTORE (re-activate) ─────────────────────────────────────────────────────
// Doc31 #22: deleted_by now tracked (migration_adjustment_approval.sql) — real maker!=checker: same user who
// deleted cannot restore unless admin (level5). Base gate matches the delete-tier for that table.
const requireDifferentFromDeleter = (table) => async (req, res, next) => {
  const { rows } = await pool.query(`SELECT deleted_by FROM ${table} WHERE id=$1`, [req.params.id]);
  if (rows.length && rows[0].deleted_by === req.user.id && req.user.role_level < 5) {
    return res.status(403).json({ success: false, message: 'Cannot restore your own delete — needs different user (or admin override)' });
  }
  next();
};
router.put('/machines/:id/restore', auth, requireLevel(4), requireDifferentFromDeleter('machines'), ar(async (req, res) => {
  await pool.query('UPDATE machines SET is_active=true WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));
router.put('/grades/:id/restore', auth, requireLevel(4), requireDifferentFromDeleter('grades'), ar(async (req, res) => {
  await pool.query('UPDATE grades SET is_active=true WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));
router.put('/materials/:id/restore', auth, requireLevel(3), requireDifferentFromDeleter('materials'), ar(async (req, res) => {
  await pool.query('UPDATE materials SET is_active=true WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));
router.put('/vendors/:id/restore', auth, requireLevel(3), requireDifferentFromDeleter('vendors'), ar(async (req, res) => {
  await pool.query('UPDATE vendors SET is_active=true WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));
router.put('/customers/:id/restore', auth, requireLevel(3), requireDifferentFromDeleter('customers'), ar(async (req, res) => {
  await pool.query('UPDATE customers SET is_active=true WHERE id=$1', [req.params.id]);
  publish(TOPICS.EVENTS_ALL, `customer-${req.params.id}`, { event: 'customer.restored', id: req.params.id, userId: req.user.id, timestamp: new Date() });
  res.json({ success: true });
}));


// ── SECTIONS ─────────────────────────────────────────────────────────────────
router.get('/sections', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, d.name as "departmentName" FROM sections s 
     LEFT JOIN departments d ON d.id=s.department_id 
     ORDER BY s.name`
  );
  res.json({ success: true, data: rows });
}));

router.post('/sections', auth, requireLevel(3), ar(async (req, res) => {
  const { name, code, department_id } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Section name required' });
  const { rows } = await pool.query(
    `INSERT INTO sections (name, code, department_id) VALUES ($1, $2, $3) RETURNING *`,
    [name, code || null, department_id || null]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/sections/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { name, code, department_id, is_active } = req.body;
  const { rows } = await pool.query(
    `UPDATE sections SET name=COALESCE($1, name), code=COALESCE($2, code), 
                         department_id=COALESCE($3, department_id), is_active=COALESCE($4, is_active)
     WHERE id=$5 RETURNING *`,
    [name, code, department_id, is_active, req.params.id]
  );
  if (rows.length) publish(TOPICS.EVENTS_ALL, `section-${rows[0].id}`, { event: 'section.updated', id: rows[0].id, name: rows[0].name, userId: req.user.id, timestamp: new Date() });
  res.json({ success: !!rows.length, data: rows[0] });
}));

router.delete('/sections/:id', auth, requireLevel(3), ar(async (req, res) => {
  await pool.query('UPDATE sections SET is_active=false WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

// ── MOTOR ELECTRICAL SPECS (F2) ─────────────────────────────────────────────────
// KW/RPM/Bearing-No-FS/Bearing-No-BS — separate table, source's "Machine" bucket is coarser than
// the app's 21 granular plant sections, kept as its own section_label rather than forced onto a section_id FK.
router.get('/motors', auth, ar(async (req, res) => {
  const { section_label, search } = req.query;
  const w = []; const p = []; let i = 1;
  if (section_label) { w.push(`section_label=$${i++}`); p.push(section_label); }
  if (search) { w.push(`motor_name ILIKE $${i++}`); p.push(`%${search}%`); }
  const { rows } = await pool.query(
    `SELECT * FROM motor_electrical_specs ${w.length ? 'WHERE '+w.join(' AND ') : ''} ORDER BY section_label, sr_no`, p);
  res.json({ success: true, data: rows });
}));

router.get('/motors/sections', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT section_label, COUNT(*) AS count FROM motor_electrical_specs GROUP BY section_label ORDER BY section_label`);
  res.json({ success: true, data: rows });
}));

router.post('/motors', auth, requireLevel(4), ar(async (req, res) => {
  const { motor_name, kw, hp, rpm, full_amp, bearing_no_fs, bearing_no_bs, section_label } = req.body;
  if (!motor_name || !section_label) return res.status(400).json({ success: false, message: 'motor_name and section_label required' });
  const { rows: [maxSr] } = await pool.query(
    `SELECT COALESCE(MAX(sr_no),0)+1 AS n FROM motor_electrical_specs WHERE section_label=$1`, [section_label]);
  const { rows } = await pool.query(
    `INSERT INTO motor_electrical_specs (sr_no, motor_name, kw, hp, rpm, full_amp, bearing_no_fs, bearing_no_bs, section_label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [maxSr.n, motor_name, kw||null, hp||null, rpm||null, full_amp||null, bearing_no_fs||null, bearing_no_bs||null, section_label]
  );
  publish(TOPICS.EVENTS_ALL, `motor-${rows[0].id}`, { event: 'motor.created', id: rows[0].id, motor_name, section_label, userId: req.user.id, timestamp: new Date() });
  res.status(201).json({ success: true, data: rows[0] });
}));

router.put('/motors/:id', auth, requireLevel(4), ar(async (req, res) => {
  const { motor_name, kw, hp, rpm, full_amp, bearing_no_fs, bearing_no_bs, section_label } = req.body;
  const { rows } = await pool.query(
    `UPDATE motor_electrical_specs SET
       motor_name=COALESCE($1,motor_name), kw=$2, hp=$3, rpm=$4, full_amp=$5,
       bearing_no_fs=$6, bearing_no_bs=$7, section_label=COALESCE($8,section_label)
     WHERE id=$9 RETURNING *`,
    [motor_name, kw||null, hp||null, rpm||null, full_amp||null, bearing_no_fs||null, bearing_no_bs||null, section_label, req.params.id]
  );
  if (rows.length) publish(TOPICS.EVENTS_ALL, `motor-${req.params.id}`, { event: 'motor.updated', id: rows[0].id, userId: req.user.id, timestamp: new Date() });
  res.json({ success: !!rows.length, data: rows[0] });
}));

router.delete('/motors/:id', auth, requireLevel(4), ar(async (req, res) => {
  await pool.query('DELETE FROM motor_electrical_specs WHERE id=$1', [req.params.id]);
  publish(TOPICS.EVENTS_ALL, `motor-${req.params.id}`, { event: 'motor.deleted', id: req.params.id, userId: req.user.id, timestamp: new Date() });
  res.json({ success: true });
}));

// ── ERROR HANDLER ─────────────────────────────────────────────────────────────
router.use((err,req,res,next) => {
  if (err.code==='23505') return res.status(409).json({ success:false, message:'Duplicate record' });
  console.error(err);
  res.status(500).json({ success:false, message:'Server error' });
});

module.exports = router;
