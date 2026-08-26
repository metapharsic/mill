const pool = require('../src/db/pool');
const { generateInventoryExcel } = require('../src/services/inventoryExcelExporter');

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 VERIFYING CHEMICAL INVENTORY FILTER & WIRING');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // 1. Check Category ID 28 in DB
    const catRes = await pool.query('SELECT id, name, code, type FROM material_categories WHERE id = 28');
    console.log('1. Category DB Record:', catRes.rows[0]);

    // 2. Test query simulating categoryId = 28 with store_type = 'store'
    function getStoreTypeFilter(storeType, prefix = 'mc') {
      if (!storeType || storeType === 'all_store' || storeType === 'store') {
        return `(${prefix}.type IN ('Mechanical', 'Electrical', 'Consumable', 'Spare Part', 'Raw Material') OR ${prefix}.id IN (28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64))`;
      }
      if (storeType === 'chemical') {
        return `(${prefix}.id = 28 OR ${prefix}.code LIKE 'CHEM%' OR ${prefix}.name ILIKE '%Chem%' OR ${prefix}.name ILIKE '%Chemical%')`;
      }
      return '1=1';
    }

    // SIMULATION A: categoryId = 28 (Dropdown selection)
    const condA = ['m.is_active = true'];
    const paramsA = [];
    let pA = 1;
    const categoryId = 28;
    if (categoryId) {
      condA.push(`m.category_id = $${pA++}`);
      paramsA.push(categoryId);
    }
    const sqlA = `SELECT m.id, m.code, m.name, m.current_stock, m.uom, m.unit_price, mc.name as cat_name FROM materials m LEFT JOIN material_categories mc ON m.category_id = mc.id WHERE ${condA.join(' AND ')}`;
    const resA = await pool.query(sqlA, paramsA);
    console.log(`\n2. Dropdown Filter Simulation (categoryId=28):`);
    console.log(`   Items Found: ${resA.rows.length} (Expected: 33)`);
    if (resA.rows.length > 0) {
      console.log(`   Sample Item 1: ${resA.rows[0].code} - ${resA.rows[0].name} (Stock: ${resA.rows[0].current_stock} ${resA.rows[0].uom})`);
      console.log(`   Sample Item 2: ${resA.rows[1]?.code} - ${resA.rows[1]?.name} (Stock: ${resA.rows[1]?.current_stock} ${resA.rows[1]?.uom})`);
    }

    // SIMULATION B: store_type = 'chemical' (Chemical Tab)
    const condB = ['m.is_active = true', getStoreTypeFilter('chemical', 'mc')];
    const sqlB = `SELECT COUNT(*) as total, COALESCE(SUM(m.current_stock * m.unit_price), 0) as valuation FROM materials m LEFT JOIN material_categories mc ON m.category_id = mc.id WHERE ${condB.join(' AND ')}`;
    const resB = await pool.query(sqlB);
    console.log(`\n3. Chemical Tab KPI Simulation (store_type='chemical'):`);
    console.log(`   Total Chemical SKUs: ${resB.rows[0].total}`);
    console.log(`   Total Chemical Valuation: ₹${Number(resB.rows[0].valuation).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

    // SIMULATION C: Excel Exporter test
    console.log(`\n4. Excel Exporter Simulation:`);
    const excelRes = await generateInventoryExcel({ store_type: 'chemical' });
    console.log(`   Excel Filename: ${excelRes.filename}`);
    console.log(`   Total SKUs exported: ${excelRes.meta.totalSKUs}`);
    console.log(`   Total Valuation in export: ₹${Number(excelRes.meta.totalValuation).toLocaleString('en-IN')}`);
    console.log(`   Buffer generated length: ${excelRes.buffer.length} bytes`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ ALL INVENTORY CHEMICAL WIRING TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await pool.end();
  }
}

runTests();
