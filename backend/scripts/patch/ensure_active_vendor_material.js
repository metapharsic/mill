/**
 * ensure_active_vendor_material.js
 * ---------------------------------
 * Repairs the "Master Vendor and Material available for P2P transaction"
 * pre-condition used by scripts/multi_agent_system_validation.js (A_P2P audit).
 *
 * That audit does:
 *   SELECT id, name FROM vendors   WHERE is_active = true ORDER BY id LIMIT 1
 *   SELECT id, ...   FROM materials WHERE is_active = true ORDER BY id LIMIT 1
 * and fails immediately (plus throws a TypeError on every later query that
 * references vendor.id/material.id) if either query returns zero rows.
 *
 * This script guarantees at least one active vendor and one active material
 * exist, WITHOUT deleting or touching any other data:
 *   - If any vendor already has is_active = true, vendors are left alone.
 *   - Else if vendor rows exist (just none active), the oldest one (by id)
 *     is flipped to is_active = true.
 *   - Else (vendors table is completely empty), one minimal, clearly-marked
 *     vendor is inserted.
 *   - Same logic, independently, for materials.
 *
 * Idempotent: safe to run any number of times. Never inserts a duplicate
 * (each branch is guarded by an existence check first).
 *
 * This script does NOT run automatically and touches only vendors/materials.
 *
 * Run (from repo root):
 *   cd backend && node scripts/patch/ensure_active_vendor_material.js
 */

const pool = require('../../src/db/pool');

async function ensureActiveVendor(client) {
  const { rows: [activeVendor] } = await client.query(
    `SELECT id, name FROM vendors WHERE is_active = true ORDER BY id LIMIT 1`
  );
  if (activeVendor) {
    console.log(`Vendors: OK — active vendor already exists (id=${activeVendor.id}, name="${activeVendor.name}"). No change.`);
    return;
  }

  const { rows: [anyVendor] } = await client.query(
    `SELECT id, name FROM vendors ORDER BY id LIMIT 1`
  );

  if (anyVendor) {
    await client.query(`UPDATE vendors SET is_active = true WHERE id = $1`, [anyVendor.id]);
    console.log(`Vendors: no active vendor found. Flipped existing vendor id=${anyVendor.id} ("${anyVendor.name}") to is_active = true.`);
    return;
  }

  const { rows: [newVendor] } = await client.query(
    `INSERT INTO vendors (code, name, is_active)
     VALUES ('AUDIT-VENDOR-001', 'MK Paper Mill - Default Vendor (Audit Seed)', true)
     RETURNING id, name`
  );
  console.log(`Vendors: table was empty. Inserted minimal seed vendor id=${newVendor.id} ("${newVendor.name}").`);
}

async function ensureActiveMaterial(client) {
  const { rows: [activeMaterial] } = await client.query(
    `SELECT id, name FROM materials WHERE is_active = true ORDER BY id LIMIT 1`
  );
  if (activeMaterial) {
    console.log(`Materials: OK — active material already exists (id=${activeMaterial.id}, name="${activeMaterial.name}"). No change.`);
    return;
  }

  const { rows: [anyMaterial] } = await client.query(
    `SELECT id, name FROM materials ORDER BY id LIMIT 1`
  );

  if (anyMaterial) {
    await client.query(`UPDATE materials SET is_active = true WHERE id = $1`, [anyMaterial.id]);
    console.log(`Materials: no active material found. Flipped existing material id=${anyMaterial.id} ("${anyMaterial.name}") to is_active = true.`);
    return;
  }

  const { rows: [newMaterial] } = await client.query(
    `INSERT INTO materials (code, name, uom, unit_price, current_stock, is_active)
     VALUES ('AUDIT-MAT-001', 'MK Paper Mill - Default Material (Audit Seed)', 'KG', 100, 1000, true)
     RETURNING id, name`
  );
  console.log(`Materials: table was empty. Inserted minimal seed material id=${newMaterial.id} ("${newMaterial.name}").`);
}

async function main() {
  console.log('======================================================================');
  console.log('ensure_active_vendor_material.js — repairing A_P2P audit pre-conditions');
  console.log('======================================================================');

  const client = await pool.connect();
  try {
    await ensureActiveVendor(client);
    await ensureActiveMaterial(client);
    console.log('----------------------------------------------------------------------');
    console.log('Done. No other tables were touched; nothing was deleted.');
    console.log('----------------------------------------------------------------------');
  } catch (err) {
    console.error('ensure_active_vendor_material.js failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
