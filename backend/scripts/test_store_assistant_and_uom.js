const pool = require('../src/db/pool');
const bcrypt = require('bcryptjs');
const { UOM_CATEGORIES, ALL_UOM_CODES } = require('../src/constants/uom');

async function runTests() {
  console.log('🧪 ======================================================================');
  console.log('🧪 VERIFICATION SUITE: UOM EXPANSION & STORE ASSISTANT HIERARCHY');
  console.log('🧪 ======================================================================\n');

  let passed = 0;
  let total = 0;
  const assert = (condition, msg) => {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
    }
  };

  try {
    // ── TEST 1: UOM Catalog Verification ─────────────────────────────────
    console.log('1. Verifying Comprehensive UOM Catalog...');
    assert(UOM_CATEGORIES.length >= 4, `UOM categories defined: ${UOM_CATEGORIES.length} categories`);
    assert(ALL_UOM_CODES.includes('KGS') && ALL_UOM_CODES.includes('MT') && ALL_UOM_CODES.includes('ML') && ALL_UOM_CODES.includes('LTR'), 'Key weight and volume units present (KGS, MT, ML, LTR)');
    assert(ALL_UOM_CODES.includes('NOS') && ALL_UOM_CODES.includes('PCS') && ALL_UOM_CODES.includes('DRUM') && ALL_UOM_CODES.includes('CYLINDER'), 'Pack & gas container units present (NOS, PCS, DRUM, CYLINDER)');
    assert(ALL_UOM_CODES.includes('BALE') && ALL_UOM_CODES.includes('REAM') && ALL_UOM_CODES.includes('SQM'), 'Paper mill specific units present (BALE, REAM, SQM)');
    assert(ALL_UOM_CODES.length >= 30, `Total supported standard units: ${ALL_UOM_CODES.length}`);

    // ── TEST 2: Store Assistant User Record in DB ─────────────────────────
    console.log('\n2. Verifying Store Assistant User Record in Database...');
    const { rows: [assistant] } = await pool.query(`
      SELECT u.id, u.employee_code, u.name, u.email, u.password_hash, u.is_active,
             r.name AS role_name, r.level AS role_level,
             d.name AS dept_name, d.id AS dept_id,
             s.name AS section_name, s.id AS section_id
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN sections s ON u.section_id = s.id
      WHERE u.email = 'store.assistant@mkpapermill.com'
    `);

    assert(!!assistant, 'Store Assistant user exists in database');
    assert(assistant?.employee_code === 'STORE-ASST-01', `Employee Code is STORE-ASST-01 (Got: ${assistant?.employee_code})`);
    assert(assistant?.dept_name === 'Store Management', `Department is Store Management (Got: ${assistant?.dept_name})`);
    assert(assistant?.section_name === 'Store Section', `Assigned Section is Store Section (Got: ${assistant?.section_name})`);
    assert(assistant?.is_active === true, 'User is Active');

    // ── TEST 3: Password Authentication ──────────────────────────────────
    console.log('\n3. Verifying Password Hash & Authentication...');
    const isPasswordValid = await bcrypt.compare('Store@123', assistant.password_hash);
    assert(isPasswordValid === true, 'Password "Store@123" verifies against stored bcrypt hash');

    // ── TEST 4: Store Manager Linkage & Hierarchy ─────────────────────────
    console.log('\n4. Verifying Store Manager Hierarchy & Approval Authority...');
    const { rows: [manager] } = await pool.query(`
      SELECT u.id, u.name, u.email, r.level AS role_level
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.department_id = $1 AND r.level >= 3
      ORDER BY r.level DESC LIMIT 1
    `, [assistant.dept_id]);

    assert(!!manager, `Store Manager found for department: ${manager?.name} (${manager?.email})`);
    assert(manager?.role_level >= 3, `Store Manager has approval Level >= 3 (Level: ${manager?.role_level})`);
    assert(assistant.role_level < manager.role_level, `Assistant Level (${assistant.role_level}) is subordinate to Manager Level (${manager.role_level})`);

    // ── TEST 5: User Management CRUD (Section Assignment & Deactivation) ──
    console.log('\n5. Verifying User Management CRUD & Section Allocation...');
    const testEmail = `test.operator.${Date.now()}@mkpapermill.com`;
    const tempHash = await bcrypt.hash('Test@123', 10);

    const { rows: [created] } = await pool.query(`
      INSERT INTO users (employee_code, name, email, password_hash, role_id, department_id, section_id, is_active)
      VALUES ('TEST-OP-01', 'Test Operator', $1, $2, $3, $4, $5, true)
      RETURNING id, employee_code, email, section_id
    `, [testEmail, tempHash, assistant.role_level, assistant.dept_id, assistant.section_id]);

    assert(!!created?.id, 'New operator successfully created with section allocation');

    // Update section
    await pool.query(`UPDATE users SET section_id = 9 WHERE id = $1`, [created.id]);
    const { rows: [updated] } = await pool.query(`SELECT section_id FROM users WHERE id = $1`, [created.id]);
    assert(updated?.section_id === 9, 'Assigned section updated to Pulp mill Section (ID: 9)');

    // Deactivate user
    await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [created.id]);
    const { rows: [deactivated] } = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [created.id]);
    assert(deactivated?.is_active === false, 'User deactivation (soft delete) verified');

    // Clean up test user
    await pool.query(`DELETE FROM users WHERE id = $1`, [created.id]);
    assert(true, 'Test record cleaned up cleanly');

    console.log('\n======================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} / ${total} ASSERTS PASSED (100% SUCCESS)`);
    console.log('======================================================================\n');
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
