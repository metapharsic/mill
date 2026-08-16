require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function testStoreDashboardAnalytics() {
  console.log('Testing Store Dashboard Analytics Queries...');

  try {
    console.log('1. Testing kpiQuery...');
    const kpiQuery = `
      SELECT
        COALESCE(SUM(m.current_stock * m.unit_price), 0) AS total_valuation,
        COALESCE(SUM(m.current_stock), 0) AS total_qty,
        COUNT(m.id) AS total_items,
        COUNT(CASE WHEN m.current_stock <= m.min_stock THEN 1 END) AS low_stock_count,
        COUNT(CASE WHEN m.current_stock <= 0 THEN 1 END) AS out_of_stock_count
      FROM materials m
      WHERE m.is_active = true
    `;
    const { rows: [kpiStats] } = await pool.query(kpiQuery);
    console.log('  -> Success kpiStats:', kpiStats);
  } catch (e) {
    console.error('  -> Failed kpiQuery:', e);
  }

  try {
    console.log('2. Testing todayMovesQuery...');
    const todayMovesQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type IN ('grn', 'in') THEN in_qty ELSE 0 END), 0) AS today_in_qty,
        COALESCE(SUM(CASE WHEN transaction_type IN ('grn', 'in') THEN value ELSE 0 END), 0) AS today_in_val,
        COUNT(CASE WHEN transaction_type IN ('grn', 'in') THEN 1 END) AS today_in_count,
        COALESCE(SUM(CASE WHEN transaction_type IN ('issue', 'out') THEN out_qty ELSE 0 END), 0) AS today_out_qty,
        COALESCE(SUM(CASE WHEN transaction_type IN ('issue', 'out') THEN value ELSE 0 END), 0) AS today_out_val,
        COUNT(CASE WHEN transaction_type IN ('issue', 'out') THEN 1 END) AS today_out_count
      FROM stock_ledger
      WHERE date = CURRENT_DATE
    `;
    const { rows: [todayMoves] } = await pool.query(todayMovesQuery);
    console.log('  -> Success todayMoves:', todayMoves);
  } catch (e) {
    console.error('  -> Failed todayMovesQuery:', e);
  }

  try {
    console.log('3. Testing pendingIndentsQuery...');
    const pendingIndentsQuery = `
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(total_value), 0) AS value
      FROM indents
      WHERE status IN ('Submitted', 'L1 Approved', 'L2 Approved', 'Pending')
    `;
    const { rows: [pendingIndents] } = await pool.query(pendingIndentsQuery);
    console.log('  -> Success pendingIndents:', pendingIndents);
  } catch (e) {
    console.error('  -> Failed pendingIndentsQuery:', e);
  }

  try {
    console.log('4. Testing categoryQuery...');
    const categoryQuery = `
      SELECT
        COALESCE(mc.name, 'General Store') AS category_name,
        COALESCE(mc.code, 'GEN') AS category_code,
        COALESCE(mc.type, 'General') AS category_type,
        COUNT(m.id) AS item_count,
        COALESCE(SUM(m.current_stock), 0) AS total_qty,
        COALESCE(SUM(m.current_stock * m.unit_price), 0) AS valuation
      FROM materials m
      LEFT JOIN material_categories mc ON m.category_id = mc.id
      WHERE m.is_active = true
      GROUP BY mc.name, mc.code, mc.type
      ORDER BY valuation DESC
    `;
    const { rows: categoryRows } = await pool.query(categoryQuery);
    console.log('  -> Success categoryRows:', categoryRows.length);
  } catch (e) {
    console.error('  -> Failed categoryQuery:', e);
  }

  try {
    console.log('5. Testing trendQuery...');
    const trendQuery = `
      SELECT
        TO_CHAR(d::date, 'YYYY-MM-DD') AS date,
        TO_CHAR(d::date, 'Mon DD') AS label,
        COALESCE(SUM(CASE WHEN sl.transaction_type IN ('grn', 'in') THEN sl.in_qty ELSE 0 END), 0) AS inward_qty,
        COALESCE(SUM(CASE WHEN sl.transaction_type IN ('issue', 'out') THEN sl.out_qty ELSE 0 END), 0) AS outward_qty,
        COALESCE(SUM(CASE WHEN sl.transaction_type IN ('grn', 'in') THEN sl.value ELSE 0 END), 0) AS inward_val,
        COALESCE(SUM(CASE WHEN sl.transaction_type IN ('issue', 'out') THEN sl.value ELSE 0 END), 0) AS outward_val
      FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day'::interval) d
      LEFT JOIN stock_ledger sl ON DATE(sl.date) = d::date
      GROUP BY d::date
      ORDER BY d::date ASC
    `;
    const { rows: trendRows } = await pool.query(trendQuery);
    console.log('  -> Success trendRows:', trendRows.length);
  } catch (e) {
    console.error('  -> Failed trendQuery:', e);
  }

  try {
    console.log('6. Testing deptQuery...');
    const deptQuery = `
      SELECT
        d.name AS department_name,
        COUNT(DISTINCT i.id) AS issue_count,
        COALESCE(SUM(ii.issued_qty), 0) AS total_qty,
        COALESCE(SUM(COALESCE(ii.line_value, i.total_value, 0)), 0) AS total_val
      FROM departments d
      LEFT JOIN indents i ON i.department_id = d.id AND i.status IN ('Issued', 'Partially Issued', 'Approved') AND i.date >= DATE_TRUNC('month', CURRENT_DATE)
      LEFT JOIN indent_items ii ON ii.indent_id = i.id
      GROUP BY d.name
      ORDER BY total_val DESC, issue_count DESC
      LIMIT 8
    `;
    const { rows: deptRows } = await pool.query(deptQuery);
    console.log('  -> Success deptRows:', deptRows.length);
  } catch (e) {
    console.error('  -> Failed deptQuery:', e);
  }

  try {
    console.log('7. Testing critQuery...');
    const critQuery = `
      SELECT
        COALESCE(criticality_class, 'C') AS crit_class,
        COUNT(*) AS count,
        COALESCE(SUM(current_stock * unit_price), 0) AS valuation,
        COUNT(CASE WHEN current_stock <= min_stock THEN 1 END) AS low_stock_count
      FROM materials
      WHERE is_active = true
      GROUP BY COALESCE(criticality_class, 'C')
    `;
    const { rows: critRows } = await pool.query(critQuery);
    console.log('  -> Success critRows:', critRows.length);
  } catch (e) {
    console.error('  -> Failed critQuery:', e);
  }

  try {
    console.log('8. Testing topMovingQuery...');
    const topMovingQuery = `
      SELECT
        m.id,
        m.name,
        m.code,
        m.uom,
        m.current_stock,
        m.unit_price,
        (m.current_stock * m.unit_price) AS valuation,
        COALESCE(mc.name, 'General') AS category_name,
        COUNT(sl.id) AS movement_count,
        COALESCE(SUM(CASE WHEN sl.transaction_type IN ('issue', 'out') THEN sl.out_qty ELSE 0 END), 0) AS total_issued_qty,
        COALESCE(SUM(sl.value), 0) AS total_turnover_val
      FROM materials m
      LEFT JOIN material_categories mc ON m.category_id = mc.id
      LEFT JOIN stock_ledger sl ON sl.material_id = m.id AND sl.date >= CURRENT_DATE - INTERVAL '30 days'
      WHERE m.is_active = true
      GROUP BY m.id, m.name, m.code, m.uom, m.current_stock, m.unit_price, mc.name
      ORDER BY movement_count DESC, total_turnover_val DESC, valuation DESC
      LIMIT 8
    `;
    const { rows: topMovingRows } = await pool.query(topMovingQuery);
    console.log('  -> Success topMovingRows:', topMovingRows.length);
  } catch (e) {
    console.error('  -> Failed topMovingQuery:', e);
  }

  try {
    console.log('9. Testing deadStockQuery...');
    const deadStockQuery = `
      SELECT
        COUNT(m.id) AS dead_items_count,
        COALESCE(SUM(m.current_stock * m.unit_price), 0) AS dead_capital_value
      FROM materials m
      WHERE m.is_active = true
        AND m.current_stock > 0
        AND m.id NOT IN (
          SELECT DISTINCT material_id FROM stock_ledger WHERE date >= CURRENT_DATE - INTERVAL '60 days' AND material_id IS NOT NULL
        )
    `;
    const { rows: [deadStock] } = await pool.query(deadStockQuery);
    console.log('  -> Success deadStock:', deadStock);
  } catch (e) {
    console.error('  -> Failed deadStockQuery:', e);
  }

  pool.end();
}

testStoreDashboardAnalytics();
