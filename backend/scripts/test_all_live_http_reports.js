require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../src/db/pool');

async function testAllLiveHttpReports() {
  console.log('===============================================================');
  console.log('🌐 LIVE HTTP MULTI-AGENT ENDPOINT TEST');
  console.log('===============================================================');

  const { rows: users } = await pool.query('SELECT id, email, role_id FROM users WHERE is_active = true LIMIT 1');
  const user = users[0];
  const JWT_SECRET = process.env.JWT_SECRET || 'mk_paper_mill_jwt_secret_change_this';
  const token = jwt.sign({ userId: user.id }, JWT_SECRET);

  const endpoints = [
    { name: 'Plant Sections Detailed Report', url: 'http://localhost:5000/api/reports/plant-sections/detailed?from=2026-08-01&to=2026-08-26' },
    { name: 'EOD Activity (WhatsApp) Report', url: 'http://localhost:5000/api/reports/eod?date=2026-08-25' },
    { name: 'Stores & Inventory Report', url: 'http://localhost:5000/api/reports/stores?store_type=all' },
    { name: 'Indents Report', url: 'http://localhost:5000/api/reports/indents?from=2026-08-01&to=2026-08-26' },
    { name: 'Purchase Deep Dive Report', url: 'http://localhost:5000/api/reports/purchase-detailed?from=2026-08-01&to=2026-08-26' },
    { name: 'Store Master Inward GRNs API', url: 'http://localhost:5000/api/store/inward' },
    { name: 'Materials Master Catalog API', url: 'http://localhost:5000/api/master/materials?page=1&limit=10' },
    { name: 'Store Dept Consumption Report', url: 'http://localhost:5000/api/store/reports/department-wise?from=2026-08-01&to=2026-08-26' }
  ];

  let passed = 0;
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.status === 200 && data.success) {
        console.log(`  ✅ [PASS] (HTTP 200) ${ep.name}`);
        passed++;
      } else {
        console.error(`  ❌ [FAIL] (HTTP ${res.status}) ${ep.name}:`, data.message || data);
      }
    } catch (err) {
      console.error(`  ❌ [FAIL] ${ep.name}:`, err.message);
    }
  }

  console.log('===============================================================');
  console.log(`🏁 RESULT: ${passed} / ${endpoints.length} Live Endpoints Passed`);
  console.log('===============================================================');
  process.exit(passed === endpoints.length ? 0 : 1);
}

testAllLiveHttpReports();
