const fs = require('fs');

async function seed() {
  const base = 'http://localhost:5000/api';
  console.log('🚀 Starting End-to-End API Seeding...');

  // 1. Login
  const logRes = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@mkpapermill.com', password: 'admin123' })
  });
  const { token, user } = await logRes.json();
  if (!token) throw new Error('Login failed');
  console.log('✅ Logged in as Admin');

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  // Helper
  const post = async (path, body) => {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed: ${res.status} ${text}`);
    }
    const json = await res.json();
    if (!json.success) throw new Error(`POST ${path} failed: ${JSON.stringify(json)}`);
    return json;
  };
  const put = async (path, body) => {
    const res = await fetch(`${base}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PUT ${path} failed: ${res.status} ${text}`);
    }
    const json = await res.json();
    if (!json.success) throw new Error(`PUT ${path} failed: ${JSON.stringify(json)}`);
    return json;
  };

  try {
    // 2. Master Data: Vendor & Customer
    console.log('📦 Creating Vendor and Customer...');
    const vRes = await post('/master/vendors', { name: 'Global Scrap Co', email: 'global@scrap.com', phone: '1234567890', address: '123 Scrap Yard', gst: 'GST123' });
    const vendorId = vRes.data.id;

    const cRes = await post('/master/customers', { name: 'Premium Packagers', email: 'prem@pack.com', phone: '0987654321', address: '456 Paper St', gst: 'GST987', credit_limit: 1000000, credit_days: 30 });
    const customerId = cRes.data.id;

    // 3. Create Material
    console.log('📦 Creating Raw Material...');
    const mRes = await post('/master/materials', { code: 'OCC-99', name: 'Premium OCC', category: 'Raw Material', unit: 'MT', min_stock: 50 });
    const matId = mRes.data.id;

    // 4. Create PO & Receive GRN
    console.log('🛒 Creating PO & GRN...');
    const poRes = await post('/purchase/orders', { vendor_id: vendorId, items: [{ material_id: matId, quantity: 200, unit_price: 15000, gst_pct: 18 }] });
    const poId = poRes.data.id;
    await put(`/purchase/orders/${poId}/status`, { status: 'Approved' });
    
    const grnRes = await post(`/purchase/po/${poId}/grn`, {}); // Generate GRN
    console.log('✅ Received 200 MT of OCC via GRN');

    // 5. Production & Quality (Create 2 Reels)
    console.log('🏭 Producing Reels...');
    const r1 = await post('/production/reels', {
      machine_id: 1, grade_id: 1, gsm: 150, bf: 22, deckle_cm: 320,
      weight_kg: 2500, start_time: new Date().toISOString(), end_time: new Date().toISOString()
    });
    const r2 = await post('/production/reels', {
      machine_id: 1, grade_id: 1, gsm: 150, bf: 22, deckle_cm: 320,
      weight_kg: 2450, start_time: new Date().toISOString(), end_time: new Date().toISOString()
    });
    
    console.log('🔬 Testing Quality...');
    await post('/quality/tests', { reel_id: r1.data.id, test_time: new Date().toISOString(), gsm_actual: 151, bf_actual: 22.5, moisture_pct: 6, cobb_top: 25, cobb_bottom: 26, status: 'Passed' });
    await post('/quality/tests', { reel_id: r2.data.id, test_time: new Date().toISOString(), gsm_actual: 149, bf_actual: 21.8, moisture_pct: 5.8, cobb_top: 24, cobb_bottom: 25, status: 'Passed' });

    // 6. Packing & FG Warehouse
    console.log('📦 Packing Reels & Moving to FG Warehouse...');
    await put(`/production/reels/${r1.data.id}/status`, { status: 'Packed' });
    await put(`/production/reels/${r2.data.id}/status`, { status: 'Packed' });
    
    await post('/warehouse/inventory', { reel_id: r1.data.id, location: 'A1' });
    await post('/warehouse/inventory', { reel_id: r2.data.id, location: 'A2' });

    // 7. Sales Order
    console.log('💼 Creating Sales Order...');
    const soRes = await post('/sales/orders', {
      customer_id: customerId, order_date: new Date().toISOString(), expected_date: new Date().toISOString(),
      items: [{ grade_id: 1, gsm: 150, bf: 22, quantity_mt: 4.95, rate_per_mt: 32000 }]
    });
    const soId = soRes.data.id;
    await put(`/sales/orders/${soId}/status`, { status: 'Confirmed' });

    // 8. Dispatch
    console.log('🚚 Dispatching Sales Order...');
    const dRes = await post('/sales/dispatch', { sales_order_id: soId, vehicle_number: 'MH-12-AB-1234', dispatch_date: new Date().toISOString(), driver_name: 'John Doe', driver_phone: '1234567890' });
    const dispId = dRes.data.id;
    
    // Add reels to dispatch
    await post(`/sales/dispatch/${dispId}/reels`, { reel_ids: [r1.data.id, r2.data.id] });
    
    // Finalize dispatch (Creates Invoice)
    console.log('📄 Finalizing Dispatch (Generating Invoice)...');
    await post(`/sales/dispatch/${dispId}/invoice`, {});

    // 9. Finance Payment
    console.log('💰 Logging Payment Receipt...');
    await post('/finance/payments', { sales_order_id: soId, amount: 150000, reference_no: 'UTR-123456789', payment_date: new Date().toISOString() });
    
    console.log('🎉 Seed Complete! The app now has a complete lifecycle data trace!');
  } catch (err) {
    console.error('❌ Seeding Error:', err.message);
  }
}

seed();
