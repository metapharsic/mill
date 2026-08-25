require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../src/db/pool');

async function testHttpEndpoint() {
  const { rows: users } = await pool.query('SELECT id, email, role_id FROM users WHERE is_active = true LIMIT 1');
  const user = users[0];
  const JWT_SECRET = process.env.JWT_SECRET || 'mk_paper_mill_jwt_secret_change_this';
  const token = jwt.sign({ userId: user.id }, JWT_SECRET);

  try {
    const res = await fetch('http://localhost:5000/api/reports/plant-sections/detailed?from=2026-08-01&to=2026-08-26', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    console.log('HTTP Status:', res.status);
    console.log('Success:', data.success);
    console.log('Sections Count:', data.data?.sections?.length);
    console.log('Granular Items Count:', data.data?.granularItems?.length);
    console.log('Total Stock Valuation: ₹', Number(data.data?.kpis?.totalValuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }));

    if (res.status === 200 && data.success && data.data?.granularItems?.length > 0) {
      console.log('🎉 LIVE HTTP ENDPOINT WORKING PERFECTLY (100% HEALTHY)!');
      process.exit(0);
    } else {
      console.error('Unexpected response:', data);
      process.exit(1);
    }
  } catch (err) {
    console.error('HTTP Request failed:', err);
    process.exit(1);
  }
}

testHttpEndpoint();
