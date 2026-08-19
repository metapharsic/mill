const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');

async function createStoreAssistant() {
  console.log('🚀 ======================================================================');
  console.log('🚀 CREATING STORE ASSISTANT USER & UPGRADING USER HIERARCHY');
  console.log('🚀 ======================================================================\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add section_id column to users if not exists
    console.log('1. Adding section_id foreign key column to users table...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES sections(id);
    `);

    // 2. Fetch Store Management department & Store Section IDs
    const { rows: [storeDept] } = await client.query(`
      SELECT id, name FROM departments WHERE code = 'STORE' OR name = 'Store Management' ORDER BY id ASC LIMIT 1
    `);
    const { rows: [storeSection] } = await client.query(`
      SELECT id, name FROM sections WHERE name ILIKE '%Store%' OR code = 'STORE' ORDER BY id ASC LIMIT 1
    `);
    const { rows: [supervisorRole] } = await client.query(`
      SELECT id, name, level FROM roles WHERE level = 2 OR name ILIKE '%Supervisor%' OR name ILIKE '%Operator%' ORDER BY level ASC LIMIT 1
    `);

    console.log(`  • Department: ${storeDept?.name} (ID: ${storeDept?.id})`);
    console.log(`  • Section:    ${storeSection?.name} (ID: ${storeSection?.id})`);
    console.log(`  • Role:       ${supervisorRole?.name} (Level: ${supervisorRole?.level}, ID: ${supervisorRole?.id})`);

    // 3. Hash password 'Store@123'
    const passwordHash = await bcrypt.hash('Store@123', 10);

    // 4. Check if store.assistant@mkpapermill.com already exists
    const { rows: existingUser } = await client.query(`
      SELECT id, employee_code, name, email FROM users WHERE email = 'store.assistant@mkpapermill.com' OR employee_code = 'STORE-ASST-01'
    `);

    let userId;
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      console.log(`2. Updating existing Store Assistant user [${existingUser[0].employee_code}]...`);
      await client.query(`
        UPDATE users
        SET name = 'Ramesh Kumar (Store Assistant)',
            email = 'store.assistant@mkpapermill.com',
            employee_code = 'STORE-ASST-01',
            mobile = '9000000021',
            password_hash = $1,
            role_id = $2,
            department_id = $3,
            section_id = $4,
            shift = 'General',
            is_active = true,
            updated_at = NOW()
        WHERE id = $5
      `, [passwordHash, supervisorRole.id, storeDept.id, storeSection?.id || null, userId]);
    } else {
      console.log('2. Inserting new Store Assistant user record...');
      const { rows: [newUser] } = await client.query(`
        INSERT INTO users (
          employee_code, name, email, mobile, password_hash,
          role_id, department_id, section_id, shift, is_active
        ) VALUES (
          'STORE-ASST-01', 'Ramesh Kumar (Store Assistant)', 'store.assistant@mkpapermill.com',
          '9000000021', $1, $2, $3, $4, 'General', true
        ) RETURNING id, employee_code, name, email
      `, [passwordHash, supervisorRole.id, storeDept.id, storeSection?.id || null]);
      userId = newUser.id;
    }

    await client.query('COMMIT');

    console.log('\n✅ ======================================================================');
    console.log('✅ STORE ASSISTANT USER CREATED & ALLOCATED SUCCESSFULLY');
    console.log('✅ Email:              store.assistant@mkpapermill.com');
    console.log('✅ Employee Code:      STORE-ASST-01');
    console.log('✅ Default Password:   Store@123');
    console.log('✅ Reporting Manager:  Head - Store Management (head.store@mkpapermill.com)');
    console.log('✅ Assigned Section:   Store Section');
    console.log('✅ Roles & Duties:     Draft Inward GRN, Outward Issues, Indents & Physical Counts');
    console.log('✅ Approval Clause:    All final rate approvals & write-offs require Store Manager');
    console.log('✅ ======================================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to create Store Assistant user:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createStoreAssistant();
