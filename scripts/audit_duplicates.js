const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/db/pool'));

async function auditAndDeduplicate() {
  const client = await pool.connect();
  
  console.log('='.repeat(90));
  console.log('🔍 AUDITING DUPLICATES & VISIBILITY ACROSS ALL PROCUREMENT ENTITIES');
  console.log('='.repeat(90));

  // 1. Check Indents (PR)
  console.log('\n--- 1. PURCHASE REQUISITIONS (INDENTS) ---');
  const { rows: dupPR } = await client.query(`
    SELECT indent_number, COUNT(*) as cnt
    FROM indents
    GROUP BY indent_number
    HAVING COUNT(*) > 1;
  `);
  console.log(`  Duplicate indent_numbers: ${dupPR.length}`);
  if (dupPR.length > 0) console.log('  ⚠️ Duplicates:', dupPR);

  // 2. Check Purchase Orders (PO)
  console.log('\n--- 2. PURCHASE ORDERS (PO) ---');
  const { rows: dupPO } = await client.query(`
    SELECT po_number, COUNT(*) as cnt
    FROM purchase_orders
    GROUP BY po_number
    HAVING COUNT(*) > 1;
  `);
  console.log(`  Duplicate po_numbers: ${dupPO.length}`);
  if (dupPO.length > 0) console.log('  ⚠️ Duplicates:', dupPO);

  // 3. Check Gate Passes / DC
  console.log('\n--- 3. GATE PASSES / DC ---');
  const { rows: dupGP } = await client.query(`
    SELECT gp_number, COUNT(*) as cnt
    FROM gate_passes
    GROUP BY gp_number
    HAVING COUNT(*) > 1;
  `);
  console.log(`  Duplicate gp_numbers: ${dupGP.length}`);
  if (dupGP.length > 0) console.log('  ⚠️ Duplicates:', dupGP);

  // 4. Check GRN
  console.log('\n--- 4. GOODS RECEIPT NOTES (GRN) ---');
  const { rows: dupGRN } = await client.query(`
    SELECT grn_number, COUNT(*) as cnt
    FROM grn
    GROUP BY grn_number
    HAVING COUNT(*) > 1;
  `);
  console.log(`  Duplicate grn_numbers: ${dupGRN.length}`);
  if (dupGRN.length > 0) console.log('  ⚠️ Duplicates:', dupGRN);

  // 5. Check Vendor Bills / Invoices
  console.log('\n--- 5. VENDOR BILLS / INVOICES ---');
  const { rows: dupBills } = await client.query(`
    SELECT bill_number, COUNT(*) as cnt
    FROM vendor_bills
    GROUP BY bill_number
    HAVING COUNT(*) > 1;
  `);
  console.log(`  Duplicate bill_numbers: ${dupBills.length}`);
  if (dupBills.length > 0) console.log('  ⚠️ Duplicates:', dupBills);

  // 6. Check Inbound DCs
  console.log('\n--- 6. INBOUND DELIVERY CHALLANS ---');
  const { rows: dupDC } = await client.query(`
    SELECT dc_number, COUNT(*) as cnt
    FROM inbound_delivery_challans
    GROUP BY dc_number
    HAVING COUNT(*) > 1;
  `);
  console.log(`  Duplicate dc_numbers: ${dupDC.length}`);
  if (dupDC.length > 0) console.log('  ⚠️ Duplicates:', dupDC);

  // 7. Check Materials
  console.log('\n--- 7. MATERIALS CATALOG ---');
  const { rows: dupMat } = await client.query(`
    SELECT code, COUNT(*) as cnt
    FROM materials
    GROUP BY code
    HAVING COUNT(*) > 1;
  `);
  console.log(`  Duplicate material codes: ${dupMat.length}`);
  if (dupMat.length > 0) console.log('  ⚠️ Duplicates:', dupMat);

  // 8. Check Stock Ledger Duplicate Movements
  console.log('\n--- 8. STOCK LEDGER INTEGRITY ---');
  const { rows: dupLedger } = await client.query(`
    SELECT reference_type, reference_id, material_id, transaction_type, COUNT(*) as cnt
    FROM stock_ledger
    WHERE reference_id IS NOT NULL AND reference_type IS NOT NULL
    GROUP BY reference_type, reference_id, material_id, transaction_type
    HAVING COUNT(*) > 1;
  `);
  console.log(`  Duplicate stock ledger postings for same reference+material: ${dupLedger.length}`);
  if (dupLedger.length > 0) console.log('  ⚠️ Duplicates found:', dupLedger.slice(0, 5));

  client.release();
  await pool.end();
}

auditAndDeduplicate().catch(console.error);
