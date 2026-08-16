const pool = require('../src/db/pool');

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop old constraint (may already be dropped from failed last run)
    await client.query(`
      ALTER TABLE indents
      DROP CONSTRAINT IF EXISTS indents_status_check;
    `);
    console.log('Dropped old constraint');

    // Show what statuses exist before migration
    const { rows: before } = await client.query(
      `SELECT status, COUNT(*) FROM indents GROUP BY status ORDER BY status`
    );
    console.log('Current status distribution:');
    before.forEach(r => console.log(`  ${r.status}: ${r.count}`));

    // Migrate old approval-chain statuses → Submitted (they were never issued)
    const { rowCount: m1 } = await client.query(`
      UPDATE indents
      SET status = 'Submitted'
      WHERE status IN ('L1 Approved', 'L2 Approved', 'L3 Approved', 'Approved')
    `);
    console.log(`Migrated ${m1} rows from L1/L2/L3 Approved or Approved → Submitted`);

    // Migrate PO Created → Issued (closest equivalent)
    const { rowCount: m2 } = await client.query(`
      UPDATE indents
      SET status = 'Issued'
      WHERE status IN ('PO Created')
    `);
    console.log(`Migrated ${m2} rows from PO Created → Issued`);

    // Migrate Cancelled → Rejected
    const { rowCount: m3 } = await client.query(`
      UPDATE indents
      SET status = 'Rejected'
      WHERE status = 'Cancelled'
    `);
    console.log(`Migrated ${m3} rows from Cancelled → Rejected`);

    // Now add the new constraint
    await client.query(`
      ALTER TABLE indents
      ADD CONSTRAINT indents_status_check
      CHECK (status IN (
        'Draft',
        'Submitted',
        'Issued',
        'Closed',
        'Rejected'
      ));
    `);
    console.log('Added new constraint');

    await client.query('COMMIT');
    console.log('\n✅ Done — indents_status_check now allows: Draft, Submitted, Issued, Closed, Rejected');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('FAILED:', e.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

fix();
