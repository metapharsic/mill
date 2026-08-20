require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testFixes() {
  console.log('=== RUNNING SYSTEM VERIFICATION SUITE ===');
  
  // 1. Check vendors table banking columns
  console.log('\n[1/5] Checking vendors table banking columns...');
  const { rows: cols } = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name IN ('bank_name', 'account_number', 'ifsc_code', 'branch_name', 'account_holder_name', 'account_type')
  `);
  console.log(`Found ${cols.length} / 6 banking columns:`, cols.map(c => c.column_name).join(', '));
  if (cols.length < 6) throw new Error('Missing banking columns in vendors table!');

  // 2. Query vendor with banking details
  console.log('\n[2/5] Querying sample vendor banking data...');
  const { rows: vendors } = await pool.query(`
    SELECT id, name, code, gstin, bank_name, account_number, ifsc_code, branch_name, account_holder_name, account_type
    FROM vendors LIMIT 3
  `);
  console.log(`Sample vendors:`, vendors.map(v => ({ id: v.id, name: v.name, bank: v.bank_name, ac: v.account_number, ifsc: v.ifsc_code })));

  // 3. Check purchase_orders joined with indents
  console.log('\n[3/5] Querying purchase orders with linked indents...');
  const { rows: pos } = await pool.query(`
    SELECT po.id, po.po_number, po.indent_id, ind.indent_number as "indentNumber", ind.status as "indentStatus",
           v.name as "vendorName", v.bank_name as "vendorBankName", v.account_number as "vendorAccountNumber"
    FROM purchase_orders po
    LEFT JOIN indents ind ON ind.id = po.indent_id
    LEFT JOIN vendors v ON v.id = po.vendor_id
    LIMIT 5
  `);
  console.log(`Sample POs with indents:`, pos.map(p => ({
    po: p.po_number,
    indent: p.indentNumber || 'Direct PO',
    vendor: p.vendorName,
    bank: p.vendorBankName
  })));

  // 4. Check vendor bills joined with vendors banking
  console.log('\n[4/5] Querying vendor bills with vendor payout bank details...');
  const { rows: bills } = await pool.query(`
    SELECT vb.id, vb.bill_number as "billNumber", vb.total_amount as "totalAmount", vb.balance_amount as "balanceAmount",
           v.name as "vendorName", v.bank_name as "vendorBankName", v.account_number as "vendorAccountNumber", v.ifsc_code as "vendorIfscCode"
    FROM vendor_bills vb
    LEFT JOIN vendors v ON v.id = vb.vendor_id
    LIMIT 3
  `);
  console.log(`Sample Bills with vendor bank info:`, bills);

  // 5. Check approved indents available for PO conversion
  console.log('\n[5/5] Checking approved indents available for PO creation...');
  const { rows: approvedIndents } = await pool.query(`
    SELECT id, indent_number, status, department_id, total_value,
           (SELECT COUNT(*) FROM indent_items WHERE indent_id = indents.id) as item_count
    FROM indents
    WHERE status IN ('Approved', 'L2 Approved', 'PO Created')
    ORDER BY created_at DESC LIMIT 5
  `);
  console.log(`Approved/PO Indents:`, approvedIndents);

  console.log('\n=== ALL DATABASE WIRING AND INTEGRITY CHECKS PASSED ===');
  await pool.end();
}

testFixes().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
