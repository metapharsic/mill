const pool = require('../src/db/pool');

async function main() {
  console.log('🚀 Starting UOM standardisation migration across all tables...');

  // 1. Standardize materials.uom
  await pool.query(`
    UPDATE materials SET uom = 'NOS' WHERE uom ILIKE 'nos' OR uom ILIKE 'no' OR uom ILIKE 'unit%' OR uom IS NULL;
    UPDATE materials SET uom = 'KGS' WHERE uom ILIKE 'kgs' OR uom ILIKE 'kg';
    UPDATE materials SET uom = 'MT' WHERE uom ILIKE 'mt' OR uom ILIKE 'ton%' OR uom ILIKE 'tonne%';
    UPDATE materials SET uom = 'MTR' WHERE uom ILIKE 'mtr' OR uom ILIKE 'meter%' OR uom ILIKE 'm';
    UPDATE materials SET uom = 'PKT' WHERE uom ILIKE 'pkt' OR uom ILIKE 'pack%';
    UPDATE materials SET uom = 'LTR' WHERE uom ILIKE 'ltr' OR uom ILIKE 'liter%' OR uom ILIKE 'l';
    UPDATE materials SET uom = 'BOX' WHERE uom ILIKE 'box';
    UPDATE materials SET uom = 'SET' WHERE uom ILIKE 'set';
    UPDATE materials SET uom = 'ROLL' WHERE uom ILIKE 'roll';
    UPDATE materials SET uom = 'DRUM' WHERE uom ILIKE 'drum';
    UPDATE materials SET uom = 'PAIR' WHERE uom ILIKE 'pair';
    UPDATE materials SET uom = 'BAG' WHERE uom ILIKE 'bag';
    UPDATE materials SET uom = 'SHT' WHERE uom ILIKE 'sht' OR uom ILIKE 'sheet%';
  `);

  console.log('✓ Standardized materials.uom');

  // 2. Sync indent_items.uom from materials.uom
  await pool.query(`
    UPDATE indent_items ii
    SET uom = m.uom
    FROM materials m
    WHERE ii.material_id = m.id AND (ii.uom IS NULL OR ii.uom != m.uom);
  `);
  console.log('✓ Synced indent_items.uom from materials.uom');

  // 3. Sync po_items.uom from materials.uom
  await pool.query(`
    UPDATE po_items pi
    SET uom = m.uom
    FROM materials m
    WHERE pi.material_id = m.id AND (pi.uom IS NULL OR pi.uom != m.uom);
  `);
  console.log('✓ Synced po_items.uom from materials.uom');

  // 4. Sync cash_purchase_items.uom from materials.uom
  await pool.query(`
    UPDATE cash_purchase_items cpi
    SET uom = m.uom
    FROM materials m
    WHERE cpi.material_id = m.id AND (cpi.uom IS NULL OR cpi.uom != m.uom);
  `);
  console.log('✓ Synced cash_purchase_items.uom from materials.uom');

  // 5. Sync grn_items.uom from materials.uom
  await pool.query(`
    UPDATE grn_items gi
    SET uom = m.uom
    FROM materials m
    WHERE gi.material_id = m.id AND (gi.uom IS NULL OR gi.uom != m.uom);
  `);
  console.log('✓ Synced grn_items.uom from materials.uom');

  // 6. Sync material_rejections.uom from materials.uom
  await pool.query(`
    UPDATE material_rejections mr
    SET uom = m.uom
    FROM materials m
    WHERE mr.material_id = m.id AND (mr.uom IS NULL OR mr.uom != m.uom);
  `);
  console.log('✓ Synced material_rejections.uom from materials.uom');

  // 7. Sync store_return_items.uom from materials.uom
  await pool.query(`
    UPDATE store_return_items sri
    SET uom = m.uom
    FROM materials m
    WHERE sri.material_id = m.id AND (sri.uom IS NULL OR sri.uom != m.uom);
  `);
  console.log('✓ Synced store_return_items.uom from materials.uom');

  // 8. Sync store_transfer_items.uom from materials.uom
  await pool.query(`
    UPDATE store_transfer_items sti
    SET uom = m.uom
    FROM materials m
    WHERE sti.material_id = m.id AND (sti.uom IS NULL OR sti.uom != m.uom);
  `);
  console.log('✓ Synced store_transfer_items.uom from materials.uom');

  // 9. Sync store_issues.unit from materials.uom
  await pool.query(`
    UPDATE store_issues si
    SET unit = m.uom
    FROM materials m
    WHERE si.material_id = m.id AND (si.unit IS NULL OR si.unit != m.uom);
  `);
  console.log('✓ Synced store_issues.unit from materials.uom');

  // Display summary of materials UOMs
  const res = await pool.query(`
    SELECT uom, count(*) 
    FROM materials 
    GROUP BY uom 
    ORDER BY count(*) DESC
  `);
  console.log('\n--- NEW STANDARDIZED MATERIALS UOM DISTRIBUTION ---');
  console.table(res.rows);

  await pool.end();
  console.log('🎉 Migration completed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
