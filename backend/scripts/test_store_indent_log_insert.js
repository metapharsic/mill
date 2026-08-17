const pool = require('../src/db/pool');

async function testInsert() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ind] } = await client.query('SELECT id, indent_number, status FROM indents ORDER BY id DESC LIMIT 1');
    console.log('Testing with indent:', ind);

    const { rows: logResult } = await client.query(
      `INSERT INTO store_indent_log (indent_id, action, from_status, to_status, actor_id, actor_name, actor_role, note)
       VALUES ($1, 'Test Action', $2, 'Test Status', 1, 'System Test', 'Admin', 'Testing constraint resolution')
       RETURNING *`,
      [ind.id, ind.status]
    );
    console.log('✓ Successfully inserted into store_indent_log:', logResult[0]);

    // Clean up test row
    await client.query('DELETE FROM store_indent_log WHERE id = $1', [logResult[0].id]);
    await client.query('COMMIT');
    console.log('✓ Test passed and cleaned up!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Test error:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

testInsert();
