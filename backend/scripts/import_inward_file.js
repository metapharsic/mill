const path = require('path');
const xlsx = require('xlsx');
const pool = require('../src/db/pool');

const excelDateToJS = (serial) => {
  if (!serial) return '2026-08-01';
  if (typeof serial === 'string') {
    const cleaned = serial.replace(/\s+/g, '').replace(/\/0\//g, '/08/').replace(/\/\/+/g, '/');
    const parts = cleaned.split(/[\/\-]/).filter(Boolean);
    if (parts.length === 3) {
      let d, m, y;
      if (parts[0].length === 4) {
        y = parts[0]; m = parts[1]; d = parts[2];
      } else {
        d = parts[0]; m = parts[1]; y = parts[2];
        if (y.length === 2) y = '20' + y;
      }
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '2026-08-01';
  }
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().slice(0, 10);
};

async function getOrCreateCategory(name, code, type) {
  const existing = await pool.query(
    `SELECT id, name, code, type FROM material_categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) OR code = $2`,
    [name, code]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  const ins = await pool.query(
    `INSERT INTO material_categories (name, code, type) VALUES ($1, $2, $3) RETURNING id`,
    [name, code, type]
  );
  return ins.rows[0].id;
}

async function runInwardSync() {
  console.log('================================================================');
  console.log('📦 MASTER INWARD SYNC: INWORD AUGUST-2026.xlsx (MATCH BY CODE)');
  console.log('================================================================\n');

  const fp = path.join(__dirname, '../../Projects_Requirement/INWORD AUGUST-2026.xlsx');
  const wb = xlsx.readFile(fp);
  const ws = wb.Sheets['Sheet1'];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  let currentIgrn = '';
  let currentDate = '';
  let currentParty = '';
  let currentInvoiceNo = '';
  let currentInvoiceDate = '';
  let currentTransporter = '';
  let currentLrNo = '';

  const items = [];

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const igrn = r[1];
    const dateRaw = r[2];
    const itemCode = r[3]?.toString().trim();
    const particular = r[4]?.toString().trim();
    const hsn = r[5]?.toString().trim();
    const uom = r[6]?.toString().trim() || 'NOS';
    const qty = parseFloat(r[7] || 0);
    const price = parseFloat(r[8] || 0);
    const afterDiscount = parseFloat(r[12] || r[10] || price * qty);
    const party = r[21]?.toString().trim() || '';
    const invNo = r[22]?.toString().trim() || '';
    const invDateRaw = r[23];
    const transporter = r[24]?.toString().trim() || '';
    const lrNo = r[25]?.toString().trim() || '';

    if (igrn && igrn.toString().trim() !== '') currentIgrn = igrn.toString().trim();
    if (dateRaw && dateRaw.toString().trim() !== '') currentDate = dateRaw;
    if (party && party.toString().trim() !== '') currentParty = party;
    if (invNo && invNo.toString().trim() !== '') currentInvoiceNo = invNo;
    if (invDateRaw) currentInvoiceDate = invDateRaw;
    if (transporter && transporter.toString().trim() !== '') currentTransporter = transporter;
    if (lrNo && lrNo.toString().trim() !== '') currentLrNo = lrNo;

    if (itemCode && itemCode !== 'ITEM CODE' && itemCode !== 'TOTAL' && qty > 0) {
      items.push({
        igrn: currentIgrn,
        date: excelDateToJS(currentDate),
        code: itemCode,
        name: particular,
        hsn: hsn || null,
        uom: uom.toUpperCase() === 'NOS' ? 'NOS' : (uom.toUpperCase() === 'KGS' || uom.toUpperCase() === 'KG' ? 'KG' : (uom.toUpperCase() === 'MTR' ? 'MTR' : uom.toUpperCase())),
        qty,
        price,
        value: afterDiscount || qty * price,
        party: currentParty,
        invNo: currentInvoiceNo,
        invDate: excelDateToJS(currentInvoiceDate),
        transporter: currentTransporter,
        lrNo: currentLrNo
      });
    }
  }

  console.log(`Parsed ${items.length} valid Inward items from Excel.\n`);

  // First delete any previous IGRN entries from stock_ledger so sync is 100% idempotent
  await pool.query(`DELETE FROM stock_ledger WHERE reference_type = 'IGRN'`);

  let updatedCount = 0;
  let createdCount = 0;
  let totalInwardVal = 0;

  for (const it of items) {
    // 1. STRICT CODE MATCH
    let { rows: [mat] } = await pool.query(
      `SELECT * FROM materials WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))`,
      [it.code]
    );

    // If missing, create new material
    if (!mat) {
      let catId = 35; // Default General
      if (it.code.startsWith('FLT')) catId = await getOrCreateCategory('General', 'GEN', 'Consumable');
      else if (it.code.startsWith('BE')) catId = await getOrCreateCategory('Bearing', 'BEAR', 'Mechanical');
      else if (it.code.startsWith('MVB')) catId = await getOrCreateCategory('V-Belt', 'VBELT', 'Mechanical');
      else if (it.code.startsWith('MNO')) catId = await getOrCreateCategory('Nozzles', 'NOZ', 'Mechanical');
      else if (it.code.startsWith('MGU')) catId = await getOrCreateCategory('Gauges', 'GAU', 'Mechanical');
      else if (it.code.startsWith('PCY')) catId = await getOrCreateCategory('Hydraulic & Pneumatic', 'HYDPNEU', 'Spare Part');
      else if (it.code.startsWith('CH')) catId = await getOrCreateCategory('Chemical', 'CHEM', 'Raw Material');
      else if (it.code.startsWith('E')) catId = await getOrCreateCategory('Electrical General', 'ELEGEN', 'Electrical');

      const ins = await pool.query(`
        INSERT INTO materials (code, name, category_id, uom, current_stock, unit_price, hsn_code, is_active)
        VALUES ($1, $2, $3, $4, 0, $5, $6, true)
        RETURNING *
      `, [it.code, it.name || it.code, catId, it.uom, it.price, it.hsn]);
      mat = ins.rows[0];
      createdCount++;
    }

    // Update material unit price (if price > 0) and HSN
    const finalPrice = it.price > 0 ? parseFloat(it.price) : parseFloat(mat.unit_price || 0);
    const finalHsn = it.hsn ? String(it.hsn) : mat.hsn_code;

    // Check if initial opening ledger entry exists
    const { rows: [opEntry] } = await pool.query(
      `SELECT balance FROM stock_ledger WHERE material_id = $1::integer AND transaction_type = 'opening'`,
      [mat.id]
    );

    const baseStock = opEntry ? parseFloat(opEntry.balance) : parseFloat(mat.current_stock || 0);

    // Update unit_price on material
    await pool.query(`
      UPDATE materials
      SET unit_price = CASE WHEN $1::numeric > 0 THEN $1::numeric ELSE unit_price END,
          hsn_code = COALESCE($2::varchar, hsn_code)
      WHERE id = $3::integer
    `, [finalPrice, finalHsn, mat.id]);

    // Build rich remarks
    const remarkParts = [
      `[Vendor GRN ${it.igrn}]`,
      it.party ? `Party: ${it.party}` : null,
      it.invNo ? `Inv: ${it.invNo}` : null,
      it.transporter ? `Transport: ${it.transporter}` : null,
      it.lrNo ? `LR: ${it.lrNo}` : null
    ].filter(Boolean).join(' | ');

    // Insert GRN into stock_ledger
    await pool.query(`
      INSERT INTO stock_ledger (
        material_id, date, transaction_type, reference_type, reference_id,
        in_qty, out_qty, balance, unit_price, value,
        remarks, created_by
      ) VALUES (
        $1::integer, $2::date, 'grn', 'IGRN', NULL,
        $3::numeric, 0, $4::numeric, $5::numeric, $6::numeric,
        $7::text, NULL
      )
    `, [
      parseInt(mat.id), it.date, parseFloat(it.qty), baseStock + parseFloat(it.qty), finalPrice, parseFloat(it.value),
      remarkParts
    ]);

    // Update current_stock = opening_balance + sum(all non-opening in_qty) - sum(all out_qty)
    const { rows: [sumRes] } = await pool.query(`
      SELECT 
        COALESCE((SELECT balance FROM stock_ledger WHERE material_id = $1::integer AND transaction_type = 'opening' LIMIT 1), 0) AS opening_stock,
        COALESCE(SUM(in_qty) FILTER (WHERE transaction_type != 'opening'), 0) AS total_in,
        COALESCE(SUM(out_qty), 0) AS total_out
      FROM stock_ledger
      WHERE material_id = $1::integer
    `, [mat.id]);

    const realCurrentStock = parseFloat(sumRes.opening_stock) + parseFloat(sumRes.total_in) - parseFloat(sumRes.total_out);

    await pool.query(`UPDATE materials SET current_stock = $1::numeric WHERE id = $2::integer`, [realCurrentStock, mat.id]);

    updatedCount++;
    totalInwardVal += it.value;
  }

  console.log('================================================================');
  console.log('🎉 INWARD AUGUST-2026 SYNCHRONIZATION COMPLETE!');
  console.log('================================================================');
  console.log(`✅ Total GRN Transactions Processed: ${updatedCount}`);
  console.log(`✨ New Materials Created by Code: ${createdCount}`);
  console.log(`💵 Total Inward Value Recorded: ₹${totalInwardVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

  // Final cross verification
  const totalInwardInDb = await pool.query(`
    SELECT COUNT(*) as cnt, SUM(in_qty) as total_qty, SUM(value) as total_val
    FROM stock_ledger
    WHERE transaction_type = 'grn' AND reference_type = 'IGRN'
  `);

  console.log(`\n📊 DB Verification:`);
  console.log(`   GRN Entries in Stock Ledger: ${totalInwardInDb.rows[0].cnt}`);
  console.log(`   Total Qty Inwarded: ${totalInwardInDb.rows[0].total_qty}`);
  console.log(`   Total Ledger Value: ₹${Number(totalInwardInDb.rows[0].total_val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log('================================================================');
  process.exit(0);
}

runInwardSync().catch(e => {
  console.error('❌ Inward sync failed:', e);
  process.exit(1);
});
