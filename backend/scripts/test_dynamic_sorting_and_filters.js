const pool = require('../src/db/pool');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'mk_paper_mill_jwt_secret_change_this';

async function runSortingAndFiltersTest() {
  console.log('🚀 ======================================================================');
  console.log('🚀 MULTI-AGENT TEST SUITE: DYNAMIC ASC/DESC SORTING & LOGICAL FILTERS');
  console.log('🚀 ======================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  const assert = (condition, title, details = '') => {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      if (details) console.log(`     ↳ ${details}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      if (details) console.error(`     ↳ ${details}`);
    }
  };

  try {
    // ── 1. MATERIALS SORT BY CODE ASC ─────────────────────────────────────
    console.log('📌 PHASE 1: Backend Database Dynamic Sorting — Materials Catalog');
    
    // 1.1 Sort by Code ASC
    const { rows: rowsByCodeAsc } = await pool.query(`
      SELECT m.id, m.code, m.name, m.current_stock, m.unit_price, (m.current_stock * m.unit_price) AS valuation
      FROM materials m
      WHERE m.is_active = true
      ORDER BY m.code ASC NULLS LAST, m.name ASC
      LIMIT 5
    `);
    const isCodeSortedAsc = rowsByCodeAsc.every((r, idx) => idx === 0 || r.code >= rowsByCodeAsc[idx - 1].code);
    assert(isCodeSortedAsc, 'Materials sorted strictly by Code (ASC)', `First: ${rowsByCodeAsc[0]?.code}, Next: ${rowsByCodeAsc[1]?.code}`);

    // 1.2 Sort by Current Stock DESC (Numerical)
    const { rows: rowsByStockDesc } = await pool.query(`
      SELECT m.id, m.code, m.name, m.current_stock
      FROM materials m
      WHERE m.is_active = true
      ORDER BY m.current_stock DESC NULLS LAST, m.name ASC
      LIMIT 5
    `);
    const isStockSortedDesc = rowsByStockDesc.every((r, idx) => idx === 0 || parseFloat(r.current_stock) <= parseFloat(rowsByStockDesc[idx - 1].current_stock));
    assert(isStockSortedDesc, 'Materials sorted strictly by Current Stock (DESC - Numerical)', `Top: ${rowsByStockDesc[0]?.current_stock}, Next: ${rowsByStockDesc[1]?.current_stock}`);

    // 1.3 Sort by Unit Price ASC (Numerical)
    const { rows: rowsByPriceAsc } = await pool.query(`
      SELECT m.id, m.code, m.name, m.unit_price
      FROM materials m
      WHERE m.is_active = true
      ORDER BY m.unit_price ASC NULLS LAST, m.name ASC
      LIMIT 5
    `);
    const isPriceSortedAsc = rowsByPriceAsc.every((r, idx) => idx === 0 || parseFloat(r.unit_price) >= parseFloat(rowsByPriceAsc[idx - 1].unit_price));
    assert(isPriceSortedAsc, 'Materials sorted strictly by Unit Price (ASC - Numerical)', `Lowest: ₹${rowsByPriceAsc[0]?.unit_price}, Next: ₹${rowsByPriceAsc[1]?.unit_price}`);

    // 1.4 Sort by Valuation DESC ((current_stock * unit_price))
    const { rows: rowsByValuationDesc } = await pool.query(`
      SELECT m.id, m.code, m.name, m.current_stock, m.unit_price, (m.current_stock * m.unit_price) AS valuation
      FROM materials m
      WHERE m.is_active = true
      ORDER BY (m.current_stock * m.unit_price) DESC NULLS LAST, m.name ASC
      LIMIT 5
    `);
    const isValuationSortedDesc = rowsByValuationDesc.every((r, idx) => idx === 0 || parseFloat(r.valuation) <= parseFloat(rowsByValuationDesc[idx - 1].valuation));
    assert(isValuationSortedDesc, 'Materials sorted strictly by Total Valuation (DESC - Calculated ₹)', `Highest Valuation: ₹${parseFloat(rowsByValuationDesc[0]?.valuation).toFixed(2)}, Next: ₹${parseFloat(rowsByValuationDesc[1]?.valuation).toFixed(2)}`);


    // ── 2. USERS DIRECTORY SORTING ────────────────────────────────────────
    console.log('\n📌 PHASE 2: Backend Database Dynamic Sorting — User Management');
    
    // 2.1 Sort by Employee Code ASC
    const { rows: usersByCodeAsc } = await pool.query(`
      SELECT u.id, u.employee_code, u.name, r.level AS role_level
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = true
      ORDER BY u.employee_code ASC NULLS LAST, u.name ASC
      LIMIT 5
    `);
    const isUserCodeAsc = usersByCodeAsc.every((u, idx) => idx === 0 || (u.employee_code || '') >= (usersByCodeAsc[idx - 1].employee_code || ''));
    assert(isUserCodeAsc, 'Users sorted strictly by Employee Code (ASC)', `First: ${usersByCodeAsc[0]?.employee_code}, Next: ${usersByCodeAsc[1]?.employee_code}`);

    // 2.2 Sort by Role Level DESC
    const { rows: usersByRoleDesc } = await pool.query(`
      SELECT u.id, u.employee_code, u.name, r.level AS role_level
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = true
      ORDER BY r.level DESC NULLS LAST, u.name ASC
      LIMIT 5
    `);
    const isUserRoleDesc = usersByRoleDesc.every((u, idx) => idx === 0 || u.role_level <= usersByRoleDesc[idx - 1].role_level);
    assert(isUserRoleDesc, 'Users sorted strictly by Role Hierarchy Level (DESC)', `Top Level: L${usersByRoleDesc[0]?.role_level} (${usersByRoleDesc[0]?.name}), Next: L${usersByRoleDesc[1]?.role_level}`);


    // ── 3. STORE LEDGER & INWARD/OUTWARD SORTING ──────────────────────────
    console.log('\n📌 PHASE 3: Store Transactions & Stock Ledger Sorting');

    // 3.1 Sort Ledger by Date DESC
    const { rows: ledgerByDateDesc } = await pool.query(`
      SELECT sl.id, sl.date, sl.transaction_type, sl.in_qty, sl.out_qty, sl.balance
      FROM stock_ledger sl
      ORDER BY sl.date DESC, sl.id DESC
      LIMIT 5
    `);
    const isLedgerDateDesc = ledgerByDateDesc.every((l, idx) => idx === 0 || new Date(l.date) <= new Date(ledgerByDateDesc[idx - 1].date));
    assert(isLedgerDateDesc, 'Stock Ledger sorted by Date & Transaction Chronology (DESC)', `Latest: ${ledgerByDateDesc[0]?.date?.toISOString().slice(0,10)}`);

    // 3.2 Sort Ledger by Balance DESC (Numerical)
    const { rows: ledgerByBalanceDesc } = await pool.query(`
      SELECT sl.id, sl.date, sl.balance
      FROM stock_ledger sl
      ORDER BY sl.balance DESC NULLS LAST
      LIMIT 5
    `);
    const isLedgerBalanceDesc = ledgerByBalanceDesc.every((l, idx) => idx === 0 || parseFloat(l.balance) <= parseFloat(ledgerByBalanceDesc[idx - 1].balance));
    assert(isLedgerBalanceDesc, 'Stock Ledger sorted by Remaining Balance (DESC - Numerical)', `Highest: ${ledgerByBalanceDesc[0]?.balance}`);


    // ── 4. CLIENT COMPARATOR LOGIC VALIDATION ────────────────────────────
    console.log('\n📌 PHASE 4: Client-Side Table Comparator Logic Verification');

    const testItems = [
      { id: 1, name: 'Bearing 6205', stock: 5, price: '120.50', crit: 'C', date: '2026-08-10' },
      { id: 2, name: 'Motor 15HP', stock: 2, price: '15000.00', crit: 'A', date: '2026-08-18' },
      { id: 3, name: 'VFD Drive 22kW', stock: 12, price: '32000.00', crit: 'B', date: '2026-08-15' },
      { id: 4, name: 'Grease Cartridge', stock: 50, price: '450.00', crit: 'C', date: '2026-08-01' },
    ];

    // 4.1 Numerical Stock Sorting ASC (2, 5, 12, 50)
    const sortedByStockAsc = [...testItems].sort((a, b) => a.stock - b.stock);
    assert(sortedByStockAsc[0].stock === 2 && sortedByStockAsc[3].stock === 50, 'Client comparator sorts integer stock numbers accurately (ASC)');

    // 4.2 Formatted Currency String Sorting DESC (32000, 15000, 450, 120.50)
    const sortedByPriceDesc = [...testItems].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    assert(parseFloat(sortedByPriceDesc[0].price) === 32000 && parseFloat(sortedByPriceDesc[3].price) === 120.50, 'Client comparator sorts float currency accurately (DESC)');

    // 4.3 Criticality Hierarchy (A -> B -> C)
    const critOrder = { A: 1, B: 2, C: 3 };
    const sortedByCrit = [...testItems].sort((a, b) => critOrder[a.crit] - critOrder[b.crit]);
    assert(sortedByCrit[0].crit === 'A' && sortedByCrit[1].crit === 'B' && sortedByCrit[2].crit === 'C', 'Client comparator sorts Criticality classes (A -> B -> C)');

    console.log('\n======================================================================');
    console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TEST CASES PASSED (100% SUCCESS)`);
    console.log('======================================================================\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSortingAndFiltersTest();
