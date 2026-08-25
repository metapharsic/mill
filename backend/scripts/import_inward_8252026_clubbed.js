require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const path = require('path');
const xlsx = require('xlsx');
const pool = require('../src/db/pool');

const excelDateToJS = (serial) => {
  if (!serial) return '2026-08-16';
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
    return '2026-08-16';
  }
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().slice(0, 10);
};

// Extract vendor metadata from unformatted text
function parseVendorInfo(partyStr) {
  if (!partyStr || !partyStr.trim()) {
    return { name: 'Internal / Direct Purchase', gstin: null, state: 'Karnataka', city: 'Hubli', address: 'Local Supply' };
  }
  const str = partyStr.trim();
  
  // 1. GSTIN Regex
  const gstinMatch = str.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
  const gstin = gstinMatch ? gstinMatch[1].toUpperCase() : null;

  // 2. Email Regex
  const emailMatch = str.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1] : null;

  // 3. Mobile Regex
  const mobileMatch = str.match(/(?:CELL|PH|PHONE|MOBILE|TEL)?[\s:.]*([0-9]{10,12})/i);
  const mobile = mobileMatch ? mobileMatch[1] : null;

  // 4. State from GSTIN or text
  let state = 'Karnataka';
  let city = 'Karnataka';
  if (gstin) {
    const stCode = gstin.substring(0, 2);
    if (stCode === '36') { state = 'Telangana'; city = 'Hyderabad'; }
    else if (stCode === '24') { state = 'Gujarat'; city = 'Vapi'; }
    else if (stCode === '09') { state = 'Uttar Pradesh'; city = 'Muzaffarnagar'; }
    else if (stCode === '27') { state = 'Maharashtra'; city = 'Mumbai'; }
    else if (stCode === '29') { state = 'Karnataka'; city = 'Bangalore'; }
    else if (stCode === '03') { state = 'Punjab'; city = 'Phagwara'; }
    else if (stCode === '33') { state = 'Tamil Nadu'; city = 'Chennai'; }
    else if (stCode === '37') { state = 'Andhra Pradesh'; city = 'Vijayawada'; }
  } else {
    if (/hyderabad|secundrabad|secunderabad|telagana|telangana|nizamabad/i.test(str)) {
      state = 'Telangana';
      city = /nizamabad/i.test(str) ? 'Nizamabad' : 'Hyderabad';
    } else if (/mumbai|nagdevi|maharashtra/i.test(str)) {
      state = 'Maharashtra';
      city = 'Mumbai';
    } else if (/vapi|gujarat/i.test(str)) {
      state = 'Gujarat';
      city = 'Vapi';
    } else if (/uttar pradesh|muzaffaranagar|muzaffarnagar/i.test(str)) {
      state = 'Uttar Pradesh';
      city = 'Muzaffarnagar';
    }
  }

  // 5. Vendor Name
  let name = str.split(',')[0].trim();
  if (name.length > 80) name = name.substring(0, 80).trim();

  return {
    name,
    gstin,
    email,
    mobile,
    address: str,
    city,
    state
  };
}

async function getOrCreateVendor(client, partyStr) {
  const parsed = parseVendorInfo(partyStr);
  
  // Check by GSTIN first if exists
  if (parsed.gstin) {
    const { rows: byGst } = await client.query('SELECT * FROM vendors WHERE gstin = $1', [parsed.gstin]);
    if (byGst.length > 0) return byGst[0];
  }

  // Check by Name
  const { rows: byName } = await client.query(
    'SELECT * FROM vendors WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) OR LOWER(name) LIKE $2',
    [parsed.name, `%${parsed.name.toLowerCase()}%`]
  );
  if (byName.length > 0) {
    if (parsed.gstin && !byName[0].gstin) {
      await client.query('UPDATE vendors SET gstin = $1 WHERE id = $2', [parsed.gstin, byName[0].id]);
    }
    return byName[0];
  }

  // Generate unique vendor code
  const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM vendors');
  const code = `VEN-${String(parseInt(count) + 1).padStart(4, '0')}`;

  const { rows: [newVen] } = await client.query(`
    INSERT INTO vendors (code, name, gstin, address, city, state, mobile, email, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
    RETURNING *
  `, [code, parsed.name, parsed.gstin, parsed.address, parsed.city, parsed.state, parsed.mobile, parsed.email]);

  return newVen;
}

async function getOrCreateCategory(client, name, code, type) {
  const existing = await client.query(
    `SELECT id, name, code, type FROM material_categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) OR code = $2`,
    [name, code]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  const ins = await client.query(
    `INSERT INTO material_categories (name, code, type) VALUES ($1, $2, $3) RETURNING id`,
    [name, code, type]
  );
  return ins.rows[0].id;
}

async function getOrCreateMaterial(client, it) {
  let mat = null;
  
  // 1. Strict Code Match
  if (it.itemCode) {
    const { rows } = await client.query(
      `SELECT * FROM materials WHERE LOWER(TRIM(code)) = LOWER(TRIM($1))`,
      [it.itemCode]
    );
    if (rows.length > 0) mat = rows[0];
  }

  // 2. Name Match fallback
  if (!mat && it.itemName) {
    const { rows } = await client.query(
      `SELECT * FROM materials WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`,
      [it.itemName]
    );
    if (rows.length > 0) mat = rows[0];
  }

  // If not found, insert new Material
  if (!mat) {
    const code = it.itemCode || `ITM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let catId = 35; // Default General
    if (code.startsWith('FLT')) catId = await getOrCreateCategory(client, 'General', 'GEN', 'Consumable');
    else if (code.startsWith('BE') || code.startsWith('OS')) catId = await getOrCreateCategory(client, 'Bearing', 'BEAR', 'Mechanical');
    else if (code.startsWith('MVB')) catId = await getOrCreateCategory(client, 'V-Belt', 'VBELT', 'Mechanical');
    else if (code.startsWith('MNO')) catId = await getOrCreateCategory(client, 'Nozzles', 'NOZ', 'Mechanical');
    else if (code.startsWith('MGU')) catId = await getOrCreateCategory(client, 'Gauges', 'GAU', 'Mechanical');
    else if (code.startsWith('PCY')) catId = await getOrCreateCategory(client, 'Hydraulic & Pneumatic', 'HYDPNEU', 'Spare Part');
    else if (code.startsWith('CH')) catId = await getOrCreateCategory(client, 'Chemical', 'CHEM', 'Raw Material');
    else if (code.startsWith('ELEG') || code.startsWith('E')) catId = await getOrCreateCategory(client, 'Electrical General', 'ELEGEN', 'Electrical');
    else if (code.startsWith('GER')) catId = await getOrCreateCategory(client, 'General Spares', 'GENSP', 'Mechanical');
    else if (code.startsWith('PCR')) catId = await getOrCreateCategory(client, 'Machine Clothing', 'CLOTH', 'Consumable');
    else if (code.startsWith('STA')) catId = await getOrCreateCategory(client, 'Stationery', 'STAT', 'Consumable');
    else if (code.startsWith('LAB')) catId = await getOrCreateCategory(client, 'Laboratory', 'LAB', 'Quality');

    const ins = await client.query(`
      INSERT INTO materials (code, name, category_id, uom, current_stock, unit_price, hsn_code, is_active)
      VALUES ($1, $2, $3, $4, 0, $5, $6, true)
      RETURNING *
    `, [code, it.itemName || code, catId, it.uom || 'NOS', it.price || 0, it.hsn || null]);
    mat = ins.rows[0];
  } else {
    // Update existing material price (if price > 0) and HSN (if present)
    const newPrice = it.price > 0 ? it.price : mat.unit_price;
    const newHsn = it.hsn || mat.hsn_code;
    await client.query(`
      UPDATE materials 
      SET unit_price = $1, hsn_code = COALESCE($2, hsn_code)
      WHERE id = $3
    `, [newPrice, newHsn, mat.id]);
  }

  return mat;
}

async function runInwardSync() {
  console.log('================================================================');
  console.log('📦 MULTI-AGENT INWARD & MASTER GRN SYNCHRONIZATION ENGINE');
  console.log('   Source: Projects_Requirement/8252026/Inward.xlsx');
  console.log('================================================================\n');

  const fp = path.join(__dirname, '../../Projects_Requirement/8252026/Inward.xlsx');
  const wb = xlsx.readFile(fp);
  const ws = wb.Sheets['Sheet1'];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  let currentGroup = null;
  const groups = [];

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0 || r.every(cell => cell === null || cell === undefined || cell === '')) continue;
    
    const sno = r[0];
    const igrn = r[1];
    const dateRaw = r[2];
    const itemCode = r[3];
    const itemName = r[4];
    const hsn = r[5];
    const uom = r[6];
    const qty = r[7];
    const price = r[8];
    const discount1 = r[9];
    const subTotal = r[10];
    const discount2 = r[11];
    const afterDiscount = r[12];
    const cgst9 = r[13];
    const cgst2_5 = r[14];
    const sgst9 = r[15];
    const sgst2_5 = r[16];
    const igst = r[17];
    const taxVal = r[18];
    const lineTotal = r[19];
    const invoiceTotal = r[20];
    const party = r[21];
    const invoiceNo = r[22];
    const invoiceDateRaw = r[23];
    const transporter = r[24];
    const lrNo = r[25];
    const creditOrCash = r[26];

    const hasNewHeader = (sno !== null && sno !== undefined && sno !== '') || (igrn && igrn.toString().trim() !== '');

    if (hasNewHeader) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        startRow: i,
        sno: sno,
        igrn: igrn ? igrn.toString().trim() : '',
        dateRaw: dateRaw,
        date: excelDateToJS(dateRaw),
        party: party ? party.toString().trim() : '',
        invoiceNo: invoiceNo ? invoiceNo.toString().trim() : '',
        invoiceDateRaw: invoiceDateRaw,
        invoiceDate: invoiceDateRaw ? excelDateToJS(invoiceDateRaw) : excelDateToJS(dateRaw),
        transporter: transporter ? transporter.toString().trim() : '',
        lrNo: lrNo ? lrNo.toString().trim() : '',
        creditOrCash: creditOrCash ? creditOrCash.toString().trim() : 'CREDIT',
        invoiceTotal: invoiceTotal !== undefined && invoiceTotal !== null ? parseFloat(invoiceTotal) : null,
        items: []
      };
    }

    if (currentGroup) {
      if (party && !currentGroup.party) currentGroup.party = party.toString().trim();
      if (invoiceNo && !currentGroup.invoiceNo) currentGroup.invoiceNo = invoiceNo.toString().trim();
      if (invoiceDateRaw && !currentGroup.invoiceDateRaw) {
        currentGroup.invoiceDateRaw = invoiceDateRaw;
        currentGroup.invoiceDate = excelDateToJS(invoiceDateRaw);
      }
      if (transporter && !currentGroup.transporter) currentGroup.transporter = transporter.toString().trim();
      if (lrNo && !currentGroup.lrNo) currentGroup.lrNo = lrNo.toString().trim();
      if (creditOrCash && !currentGroup.creditOrCash) currentGroup.creditOrCash = creditOrCash.toString().trim();
      if (invoiceTotal !== undefined && invoiceTotal !== null && currentGroup.invoiceTotal === null) {
        currentGroup.invoiceTotal = parseFloat(invoiceTotal);
      }

      if (itemCode || itemName) {
        const q = parseFloat(qty || 0);
        const p = parseFloat(price || 0);
        const disc = parseFloat(discount1 || discount2 || 0);
        const sub = parseFloat(subTotal || (q * p));
        const afterDisc = parseFloat(afterDiscount || (sub - disc) || sub);
        const cg = parseFloat(cgst9 || cgst2_5 || 0);
        const sg = parseFloat(sgst9 || sgst2_5 || 0);
        const ig = parseFloat(igst || 0);
        let tax = parseFloat(taxVal || 0);
        if (tax === 0 && (cg > 0 || sg > 0 || ig > 0)) {
          tax = cg + sg + ig;
        }
        let tot = parseFloat(lineTotal || (afterDisc + tax));

        let gstPct = 0;
        let cgPct = 0;
        let sgPct = 0;
        let igPct = 0;
        let taxType = 'intra';

        if (cgst9 || sgst9) {
          gstPct = 18; cgPct = 9; sgPct = 9; taxType = 'intra';
        } else if (cgst2_5 || sgst2_5) {
          gstPct = 5; cgPct = 2.5; sgPct = 2.5; taxType = 'intra';
        } else if (ig > 0 && afterDisc > 0) {
          gstPct = Math.round((ig / afterDisc) * 100);
          igPct = gstPct;
          taxType = 'inter';
        } else if (tax > 0 && afterDisc > 0) {
          gstPct = Math.round((tax / afterDisc) * 100);
          cgPct = gstPct / 2;
          sgPct = gstPct / 2;
          taxType = 'intra';
        }

        currentGroup.items.push({
          row: i,
          itemCode: itemCode ? itemCode.toString().trim() : null,
          itemName: itemName ? itemName.toString().trim() : (itemCode || 'Unnamed Item'),
          hsn: hsn ? hsn.toString().trim() : null,
          uom: uom ? uom.toString().trim().toUpperCase() : 'NOS',
          qty: q,
          price: p,
          discount: disc,
          subTotal: sub,
          afterDiscount: afterDisc,
          gstPct,
          taxType,
          cgstPct: cgPct,
          sgstPct: sgPct,
          igstPct: igPct,
          cgst: cg,
          sgst: sg,
          igst: ig,
          taxVal: tax,
          lineTotal: tot
        });
      }
    }
  }
  if (currentGroup) groups.push(currentGroup);

  console.log(`Parsed ${groups.length} distinct Master GRN groups from Inward sheet.\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clean up prior 8252026 / IGRN entries cleanly to maintain absolute idempotency
    console.log('🔄 Cleaning up previous inward sync artifacts for 100% clean rebuild...');
    await client.query(`DELETE FROM vendor_bills WHERE bill_number LIKE 'BILL-202608-%' OR bill_number LIKE 'BILL-2026608-%'`);
    await client.query(`DELETE FROM stock_ledger WHERE reference_type IN ('IGRN', 'GRN') AND (remarks LIKE '%[GRN 202608-%' OR remarks LIKE '%[GRN 2026608-%' OR remarks LIKE '%[Vendor GRN 202608-%' OR remarks LIKE '%[Vendor GRN 2026608-%')`);
    await client.query(`DELETE FROM grn WHERE grn_number LIKE '202608-%' OR grn_number LIKE '2026608-%' OR grn_number LIKE 'GRN-202608-%'`);

    let createdGrnCount = 0;
    let createdItemCount = 0;
    let totalTaxableAll = 0;
    let totalGstAll = 0;
    let grandTotalAll = 0;
    const affectedMaterialIds = new Set();
    const usedGrnNumbers = new Set();

    for (let idx = 0; idx < groups.length; idx++) {
      const g = groups[idx];
      const vendor = await getOrCreateVendor(client, g.party);

      // Compute consolidated sums for this GRN
      const grnTotalValue = g.items.reduce((s, it) => s + it.subTotal, 0);
      const grnDiscountValue = g.items.reduce((s, it) => s + it.discount, 0);
      const grnTotalTaxable = g.items.reduce((s, it) => s + it.afterDiscount, 0);
      const grnCgstValue = g.items.reduce((s, it) => s + it.cgst, 0);
      const grnSgstValue = g.items.reduce((s, it) => s + it.sgst, 0);
      const grnIgstValue = g.items.reduce((s, it) => s + it.igst, 0);
      const grnTotalGst = grnCgstValue + grnSgstValue + grnIgstValue;
      const grnGrandTotal = g.invoiceTotal !== null ? g.invoiceTotal : Math.round(grnTotalTaxable + grnTotalGst);

      // Format canonical GRN number ensuring 100% uniqueness
      let baseGrnNum = g.igrn ? g.igrn.replace(/--+/g, '-').replace('2026608', '202608') : `202608-${String(g.sno || idx + 1).padStart(2, '0')}`;
      let grnNum = baseGrnNum;
      let suffix = 1;
      while (usedGrnNumbers.has(grnNum)) {
        suffix++;
        grnNum = `${baseGrnNum}-${suffix}`;
      }
      usedGrnNumbers.add(grnNum);

      // Insert 1 consolidated Master GRN
      const { rows: [grnRow] } = await client.query(`
        INSERT INTO grn (
          grn_number, date, vendor_id, invoice_number, order_date,
          total_value, discount_value, total_taxable,
          cgst_value, sgst_value, igst_value, total_gst, gst_value, grand_total,
          transport_name, challan_number, payment_mode, status, received_by,
          remarks
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12, $12, $13,
          $14, $15, $16, 'Received', 1,
          $17
        ) RETURNING id, grn_number
      `, [
        grnNum,
        g.date,
        vendor.id,
        g.invoiceNo || null,
        g.invoiceDate || g.date,
        grnTotalValue,
        grnDiscountValue,
        grnTotalTaxable,
        grnCgstValue,
        grnSgstValue,
        grnIgstValue,
        grnTotalGst,
        grnGrandTotal,
        g.transporter || null,
        g.lrNo || null,
        g.creditOrCash || 'CREDIT',
        `Imported from 8252026 Inward Sheet (S.No ${g.sno || (idx + 1)}) | Party: ${vendor.name}`
      ]);

      const grnId = grnRow.id;
      createdGrnCount++;

      // Insert each clubbed line item
      for (const it of g.items) {
        const mat = await getOrCreateMaterial(client, it);
        affectedMaterialIds.add(mat.id);

        await client.query(`
          INSERT INTO grn_items (
            grn_id, material_id, po_qty, received_qty, accepted_qty, rejected_qty,
            uom, unit_price, discount_amount, taxable_amount, gst_pct, tax_type,
            cgst_pct, sgst_pct, igst_pct, cgst_amount, sgst_amount, igst_amount,
            total_amount, trade_price, mrp, remarks
          ) VALUES (
            $1, $2, $3, $3, $3, 0,
            $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15,
            $16, $5, $5, $17
          )
        `, [
          grnId,
          mat.id,
          it.qty,
          it.uom,
          it.price,
          it.discount,
          it.afterDiscount,
          it.gstPct,
          it.taxType,
          it.cgstPct,
          it.sgstPct,
          it.igstPct,
          it.cgst,
          it.sgst,
          it.igst,
          it.lineTotal,
          `Item: ${it.itemName}`
        ]);

        // Insert atomic stock ledger entry linked to Master GRN
        const remarkParts = [
          `[GRN ${grnNum}]`,
          vendor.name ? `Party: ${vendor.name}` : null,
          g.invoiceNo ? `Inv: ${g.invoiceNo}` : null,
          g.transporter ? `Transport: ${g.transporter}` : null,
          g.lrNo ? `LR: ${g.lrNo}` : null
        ].filter(Boolean).join(' | ');

        await client.query(`
          INSERT INTO stock_ledger (
            material_id, date, transaction_type, reference_type, reference_id,
            in_qty, out_qty, balance, unit_price, value,
            remarks, vendor_id, created_by
          ) VALUES (
            $1, $2, 'grn', 'GRN', $3,
            $4, 0, 0, $5, $6,
            $7, $8, 1
          )
        `, [
          mat.id,
          g.date,
          grnId,
          it.qty,
          it.price,
          it.lineTotal,
          remarkParts,
          vendor.id
        ]);

        createdItemCount++;
      }

      // Create Finance Accounts Payable Vendor Bill
      if (grnGrandTotal > 0) {
        const billNum = `BILL-${grnNum.replace(/[^a-zA-Z0-9]/g, '')}`;
        await client.query(`
          INSERT INTO vendor_bills (
            bill_number, vendor_id, grn_id, vendor_invoice_number, invoice_date, due_date,
            taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax,
            roundoff, total_amount, paid_amount, balance_amount, status, remarks, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            0, $12, 0, $12, 'Unpaid', $13, 1
          )
          ON CONFLICT DO NOTHING
        `, [
          billNum,
          vendor.id,
          grnId,
          g.invoiceNo || `INV-${grnNum}`,
          g.invoiceDate || g.date,
          g.invoiceDate || g.date,
          grnTotalTaxable,
          grnCgstValue,
          grnSgstValue,
          grnIgstValue,
          grnTotalGst,
          grnGrandTotal,
          `Automated AP Bill for GRN ${grnNum} from ${vendor.name}`
        ]);
      }

      totalTaxableAll += grnTotalTaxable;
      totalGstAll += grnTotalGst;
      grandTotalAll += grnGrandTotal;
    }

    // Atomic Stock Rebalance across all affected materials
    console.log(`⚖️ Recalculating live atomic balances for ${affectedMaterialIds.size} materials...`);
    for (const matId of affectedMaterialIds) {
      const { rows: [sumRes] } = await client.query(`
        SELECT 
          COALESCE((SELECT balance FROM stock_ledger WHERE material_id = $1 AND transaction_type = 'opening' LIMIT 1), 0) AS opening_stock,
          COALESCE(SUM(in_qty) FILTER (WHERE transaction_type != 'opening'), 0) AS total_in,
          COALESCE(SUM(out_qty), 0) AS total_out
        FROM stock_ledger
        WHERE material_id = $1
      `, [matId]);

      const realStock = Math.max(0, parseFloat(sumRes.opening_stock) + parseFloat(sumRes.total_in) - parseFloat(sumRes.total_out));
      await client.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [realStock, matId]);

      // Update balance on ledger entries chronologically
      await client.query(`
        UPDATE stock_ledger
        SET balance = $1
        WHERE material_id = $2 AND reference_type = 'GRN' AND balance = 0
      `, [realStock, matId]);
    }

    await client.query('COMMIT');

    console.log('================================================================');
    console.log('🎉 INWARD 8252026 SYNCHRONIZATION COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
    console.log(`✅ Master GRNs Created (Clubbed): ${createdGrnCount}`);
    console.log(`✅ Total Line Items Inserted:     ${createdItemCount}`);
    console.log(`💵 Total Taxable Inward Value:    ₹${totalTaxableAll.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`💵 Total GST Recorded:            ₹${totalGstAll.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`💵 Grand Total Inward Value:      ₹${grandTotalAll.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log('================================================================\n');

    // Detailed verification of SUNRISE BEARING CORP GRN 202608-26 (from user's screenshot)
    const { rows: testGrn } = await pool.query(`
      SELECT g.id, g.grn_number, g.date, g.invoice_number, g.total_taxable, g.total_gst, g.grand_total,
             v.name as vendor_name, v.gstin as vendor_gstin
      FROM grn g
      JOIN vendors v ON g.vendor_id = v.id
      WHERE g.grn_number = '202608-26'
    `);

    if (testGrn.length > 0) {
      const gObj = testGrn[0];
      const { rows: testItems } = await pool.query(`
        SELECT gi.id, m.code, m.name, gi.received_qty, gi.uom, gi.unit_price, gi.taxable_amount,
               gi.cgst_amount, gi.sgst_amount, gi.total_amount, m.hsn_code
        FROM grn_items gi
        JOIN materials m ON gi.material_id = m.id
        WHERE gi.grn_id = $1
        ORDER BY gi.id ASC
      `, [gObj.id]);

      console.log('🔍 SCREENSHOT EXACT VERIFICATION — GRN 202608-26:');
      console.log(`   GRN Number:     ${gObj.grn_number}`);
      console.log(`   Party Name:     ${gObj.vendor_name}`);
      console.log(`   Invoice No:     ${gObj.invoice_number}`);
      console.log(`   Taxable Value:  ₹${Number(gObj.total_taxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      console.log(`   Total GST:      ₹${Number(gObj.total_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      console.log(`   Invoice Total:  ₹${Number(gObj.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      console.log(`   Clubbed Items:  ${testItems.length} items (Expected 6)`);
      console.table(testItems);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Inward sync failed with error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runInwardSync().catch(console.error);
