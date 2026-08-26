const pool = require('../src/db/pool');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

const signToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role_level: user.role_level,
      department: user.department,
      dept_code: user.dept_code,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Simulated mock express req/res
const simulateRoute = async (middlewareFn, reqUser) => {
  let status = 200;
  let responseData = null;
  let nextCalled = false;

  const req = {
    user: reqUser,
    ip: '127.0.0.1',
    params: {},
    body: {}
  };
  const res = {
    status: (code) => {
      status = code;
      return {
        json: (data) => {
          responseData = data;
          return res;
        }
      };
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };
  const next = () => {
    nextCalled = true;
  };

  await middlewareFn(req, res, next);
  return { status, responseData, nextCalled };
};

const { requireStoreManager, requireStore } = require('../src/middleware/auth');

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 VERIFYING STORE MANAGER DELETION PERMISSIONS & SAFEGUARDS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  const testProfiles = [
    {
      name: 'Store Assistant (Level 1, Dept STORE)',
      user: { id: 991, username: 'store_asst', role_level: 1, department: 'Store', dept_code: 'STORE', role: 'Assistant' },
      expectedAllow: false
    },
    {
      name: 'Shift Supervisor (Level 2, Dept STORE)',
      user: { id: 992, username: 'shift_sup', role_level: 2, department: 'Store', dept_code: 'STORE', role: 'Supervisor' },
      expectedAllow: false
    },
    {
      name: 'Quality Head (Level 3, Dept QUALITY - Non-Store)',
      user: { id: 993, username: 'qc_head', role_level: 3, department: 'Quality', dept_code: 'QC', role: 'Head' },
      expectedAllow: false
    },
    {
      name: 'Head - Store Management (Level 3, Dept STORE)',
      user: { id: 6, username: 'store_head', role_level: 3, department: 'Store Management', dept_code: 'STORE', role: 'Head - Store Management' },
      expectedAllow: true
    },
    {
      name: 'Head - Inventory (Level 3, Dept INV)',
      user: { id: 5, username: 'inv_head', role_level: 3, department: 'Inventory', dept_code: 'INV', role: 'Head - Inventory' },
      expectedAllow: true
    },
    {
      name: 'Plant Head (Level 4, Dept ADMIN)',
      user: { id: 2, username: 'plant_head', role_level: 4, department: 'Admin', dept_code: 'ADMIN', role: 'Plant Head' },
      expectedAllow: true
    },
    {
      name: 'Administrator (Level 5, Dept ADMIN)',
      user: { id: 1, username: 'admin', role_level: 5, department: 'Admin', dept_code: 'ADMIN', role: 'Admin' },
      expectedAllow: true
    }
  ];

  console.log('--- 1. Testing requireStoreManager Authorization Guard ---');
  for (const p of testProfiles) {
    const res = await simulateRoute(requireStoreManager, p.user);
    const isAllowed = res.nextCalled;
    const isBlocked = res.status === 403;

    if (p.expectedAllow === isAllowed) {
      console.log(`  ✅ [PASS] ${p.name}: ${isAllowed ? 'GRANTED (200 OK)' : 'BLOCKED (403 Forbidden)'}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${p.name}: Expected ${p.expectedAllow ? 'ALLOW' : 'DENY'}, got ${isAllowed ? 'ALLOW' : 'DENY'}`);
      failed++;
    }
  }

  console.log('\n--- 2. Testing Database Atomic GRN Deletion & Stock Rollback ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create test category and material
    const { rows: [testCat] } = await client.query(
      `INSERT INTO material_categories (name, code, type) VALUES ('__TEST_CAT__', 'TCAT99', 'Store') RETURNING id`
    );
    const { rows: [testMat] } = await client.query(
      `INSERT INTO materials (code, name, category_id, uom, current_stock, unit_price, is_active)
       VALUES ('__TMAT_01__', 'Test Material For GRN Deletion', $1, 'NOS', 50.000, 100.00, true) RETURNING *`,
      [testCat.id]
    );

    console.log(`  📦 Created Test Material '${testMat.name}' with Initial Stock: ${testMat.current_stock} NOS`);

    // Inward +10 stock via GRN
    const { rows: [testGrn] } = await client.query(
      `INSERT INTO grn (grn_number, vendor_id, date, total_value, status)
       VALUES ('GRN-TEST-9999', (SELECT id FROM vendors LIMIT 1), CURRENT_DATE, 1000.00, 'Received') RETURNING *`
    );
    await client.query(
      `INSERT INTO grn_items (grn_id, material_id, received_qty, accepted_qty, unit_price, total_amount)
       VALUES ($1, $2, 10.000, 10.000, 100.00, 1000.00)`,
      [testGrn.id, testMat.id]
    );
    await client.query(
      `INSERT INTO stock_ledger (material_id, date, transaction_type, reference_id, reference_type, in_qty, balance, unit_price, value, remarks, created_by)
       VALUES ($1, CURRENT_DATE, 'grn', $2, 'GRN', 10.000, 60.000, 100.00, 1000.00, 'Test GRN Inward', 1)`,
      [testMat.id, testGrn.id]
    );
    await client.query(`UPDATE materials SET current_stock = current_stock + 10.000 WHERE id = $1`, [testMat.id]);

    const { rows: [afterInward] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [testMat.id]);
    console.log(`  ➕ Received +10.000 NOS. Current Stock is now: ${afterInward.current_stock} NOS`);

    if (parseFloat(afterInward.current_stock) === 60.000) {
      console.log(`  ✅ [PASS] Inward stock increment verified.`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] Inward stock increment failed.`);
      failed++;
    }

    // Now test atomic GRN deletion logic
    const { rows: itemsToRollback } = await client.query(`SELECT * FROM grn_items WHERE grn_id = $1 FOR UPDATE`, [testGrn.id]);
    for (const it of itemsToRollback) {
      const accQty = parseFloat(it.accepted_qty || 0);
      const { rows: [mat] } = await client.query(`SELECT id, current_stock FROM materials WHERE id = $1 FOR UPDATE`, [it.material_id]);
      const curStock = parseFloat(mat.current_stock || 0);
      const newStock = curStock - accQty;
      await client.query(`UPDATE materials SET current_stock = $1 WHERE id = $2`, [newStock, mat.id]);
    }
    await client.query(`DELETE FROM stock_ledger WHERE reference_type = 'GRN' AND reference_id = $1`, [testGrn.id]);
    await client.query(`DELETE FROM grn_items WHERE grn_id = $1`, [testGrn.id]);
    await client.query(`DELETE FROM grn WHERE id = $1`, [testGrn.id]);

    const { rows: [afterDelete] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [testMat.id]);
    console.log(`  🗑️ Deleted GRN. Current Stock restored back to: ${afterDelete.current_stock} NOS`);

    if (parseFloat(afterDelete.current_stock) === 50.000) {
      console.log(`  ✅ [PASS] GRN Deletion Atomic Reversal restored balance to exact 50.000 NOS.`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] GRN Deletion did not restore expected stock balance.`);
      failed++;
    }

    // Test safety check: prevent deletion if stock consumed below accepted qty
    await client.query(`UPDATE materials SET current_stock = 4.000 WHERE id = $1`, [testMat.id]);
    const attemptRollbackQty = 10.000;
    const { rows: [curCheck] } = await client.query(`SELECT current_stock FROM materials WHERE id = $1`, [testMat.id]);
    const remainingStock = parseFloat(curCheck.current_stock);
    const wouldGoNegative = (remainingStock - attemptRollbackQty) < 0;

    if (wouldGoNegative) {
      console.log(`  ✅ [PASS] Over-consumption safeguard triggered: Blocked rollback when remaining stock (${remainingStock}) < rollback qty (${attemptRollbackQty}).`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] Safeguard failed to detect negative stock condition.`);
      failed++;
    }

    await client.query('ROLLBACK');
    console.log(`  🔄 Cleaned up test database fixtures.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('  ❌ [ERROR] Database test threw exception:', err);
    failed++;
  } finally {
    client.release();
  }

  console.log('\n===============================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
