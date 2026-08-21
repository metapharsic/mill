const { generateInventoryExcel } = require('../src/services/inventoryExcelExporter');

async function testCombinations() {
  console.log('🧪 Testing all export option combinations...');

  const presets = [
    { name: 'full_master', opts: { store_type: 'all', include_summary_sheet: true, include_category_sheets: true, include_reorder_sheet: true, include_high_value_sheet: true, include_slow_moving_sheet: true } },
    { name: 'mechanical', opts: { store_type: 'mechanical', include_summary_sheet: true, include_category_sheets: true, include_reorder_sheet: true } },
    { name: 'electrical', opts: { store_type: 'electrical', include_summary_sheet: true, include_category_sheets: true, include_reorder_sheet: true } },
    { name: 'reorder_urgent', opts: { store_type: 'all', stock_status: 'low_stock', include_summary_sheet: true, include_reorder_sheet: true, include_category_sheets: false } },
    { name: 'valuation_audit', opts: { store_type: 'all', include_summary_sheet: true, include_high_value_sheet: true, include_category_sheets: false } },
    { name: 'dead_stock', opts: { store_type: 'all', include_summary_sheet: true, include_slow_moving_sheet: true, include_category_sheets: false } },
    { name: 'category_bearing', opts: { category_id: 39 } },
    { name: 'section_filter', opts: { section_id: 1 } },
    { name: 'search_filter', opts: { search: '6205' } }
  ];

  for (const p of presets) {
    try {
      const res = await generateInventoryExcel(p.opts);
      console.log(`✅ [PASS] Preset "${p.name}": Generated ${res.filename} (${(res.buffer.length / 1024).toFixed(1)} KB), Sheets: ${res.meta.sheetsCount}, SKUs: ${res.meta.totalSKUs}`);
    } catch (err) {
      console.error(`❌ [FAIL] Preset "${p.name}":`, err);
    }
  }
}

testCombinations().then(() => process.exit(0));
