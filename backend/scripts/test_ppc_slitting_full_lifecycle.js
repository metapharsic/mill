const pool = require('../src/db/pool');

async function testLifecycle() {
  console.log('================================================================');
  console.log('🧪 RUNNING PPC & SLITTING-REWINDING END-TO-END LIFECYCLE TEST');
  console.log('================================================================');

  const client = await pool.connect();
  let passed = 0;
  let total = 0;

  function assert(condition, desc) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      throw new Error(`Assertion failed: ${desc}`);
    }
  }

  try {
    // 1. Get or create a sample sales order
    console.log('\n--- Step 1: Sales Order Backlog Integration ---');
    const { rows: grades } = await client.query('SELECT * FROM grades WHERE is_active = true LIMIT 1');
    const { rows: machines } = await client.query('SELECT * FROM machines WHERE is_active = true LIMIT 1');
    const { rows: users } = await client.query('SELECT * FROM users LIMIT 1');

    assert(grades.length > 0 && machines.length > 0, 'Machines and Grades available');
    const gradeId = grades[0].id;
    const machineId = machines[0].id;
    const userId = users[0].id;

    // Fetch or create test customer
    let customerId;
    const { rows: existingCust } = await client.query(`SELECT id FROM customers LIMIT 1`);
    if (existingCust.length > 0) {
      customerId = existingCust[0].id;
    } else {
      const { rows: newCust } = await client.query(
        `INSERT INTO customers (name, code, is_active) VALUES ('Apex Packaging Corp', 'CUST-PPC-01', true) RETURNING id`
      );
      customerId = newCust[0].id;
    }

    const testSoNum = `SO-PPC-${Date.now().toString().slice(-6)}`;
    const { rows: soRows } = await client.query(
      `INSERT INTO sales_orders 
         (so_number, date, customer_id, grade_id, gsm, width_mm, qty_mt, rate_per_kg, total_value, status)
       VALUES ($1, NOW(), $2, $3, 140, 1200, 10.500, 38.50, 404250, 'In Production')
       RETURNING *`,
      [testSoNum, customerId, gradeId]
    );
    const so = soRows[0];
    assert(so.id != null, `Sales Order created/found: ${so.so_number} (Qty: ${so.qty_mt} MT, Width: ${so.width_mm}mm)`);

    // 2. PPC Grade Conversion & Master Plan creation
    console.log('\n--- Step 2: PPC Grade Conversion & Cutting Pattern Setup ---');
    const targetGsm = 140;
    const targetBf = 22;
    const usableDeckleMm = 2650;
    const plannedTonnageMt = 20.000;

    // Grade conversion math:
    // Estimated single reel weight for 1200mm width, 140 GSM, 5000m length
    const estReelWeightKg = (1200 / 1000) * 5000 * (targetGsm / 1000); // 840 kg
    const reelsRequired = Math.ceil((10.5 * 1000) / estReelWeightKg); // ~13 reels
    console.log(`  📐 Grade Conversion: 10.5 MT @ 1200mm ➔ Est Reel Wt: ${estReelWeightKg} kg ➔ Reels Required: ${reelsRequired}`);

    // Create plan in DB
    const planNumber = `PPC-TEST-${Date.now().toString().slice(-6)}`;
    const { rows: planRows } = await client.query(
      `INSERT INTO ppc_production_plans 
         (plan_number, machine_id, target_date, grade_id, target_gsm, target_bf, usable_deckle_mm, planned_tonnage_mt, status, created_by)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, 'SCHEDULED', $8)
       RETURNING *`,
      [planNumber, machineId, gradeId, targetGsm, targetBf, usableDeckleMm, plannedTonnageMt, userId]
    );
    const plan = planRows[0];
    assert(plan.id != null, `PPC Production Plan created: ${plan.plan_number}`);

    // Create dynamic 4-cut pattern (1200mm + 600mm + 500mm + 300mm = 2600mm, Trim = 50mm / 1.88%)
    const cuts = [
      { cut_position: 1, width_mm: 1200, sales_order_id: so.id, remarks: 'Customer Order' },
      { cut_position: 2, width_mm: 600, sales_order_id: null, remarks: 'Stock Size' },
      { cut_position: 3, width_mm: 500, sales_order_id: null, remarks: 'Stock Size' },
      { cut_position: 4, width_mm: 300, sales_order_id: null, remarks: 'Corner Slit' }
    ];
    const totalCutWidth = cuts.reduce((sum, c) => sum + c.width_mm, 0); // 2600
    const plannedTrimMm = usableDeckleMm - totalCutWidth; // 50
    const trimPct = (plannedTrimMm / usableDeckleMm) * 100; // 1.886%

    const { rows: patRows } = await client.query(
      `INSERT INTO ppc_slitting_patterns 
         (plan_id, pattern_number, total_cut_width_mm, planned_trim_mm, trim_percentage, sets_planned, status)
       VALUES ($1, 1, $2, $3, $4, 2, 'QUEUED')
       RETURNING *`,
      [plan.id, totalCutWidth, plannedTrimMm, trimPct]
    );
    const pattern = patRows[0];
    assert(pattern.total_cut_width_mm == 2600 && pattern.planned_trim_mm == 50, `Pattern 1: Total Cut Width = 2600mm, Trim Loss = 50mm (${trimPct.toFixed(2)}% ≤ 2% target)`);

    for (const c of cuts) {
      await client.query(
        `INSERT INTO ppc_pattern_cuts (pattern_id, cut_position, width_mm, sales_order_id, remarks)
         VALUES ($1, $2, $3, $4, $5)`,
        [pattern.id, c.cut_position, c.width_mm, c.sales_order_id, c.remarks]
      );
    }
    const { rows: insertedCuts } = await client.query('SELECT COUNT(*) FROM ppc_pattern_cuts WHERE pattern_id = $1', [pattern.id]);
    assert(parseInt(insertedCuts[0].count) === 4, 'All 4 dynamic child cuts inserted successfully');

    // 3. Mother Reel Production
    console.log('\n--- Step 3: Mother Reel Production off PM01 ---');
    const jumboNumber = `MK-JMB-TEST-${Date.now().toString().slice(-6)}`;
    const grossWeightKg = 4500.000;
    const coreTareKg = 150.000;
    const netWeightKg = 4350.000;

    const { rows: jRows } = await client.query(
      `INSERT INTO jumbo_reels 
         (jumbo_number, machine_id, grade_id, gsm_actual, bf_actual, deckle_width_mm, gross_weight_kg, core_tare_weight_kg, status, reconciliation_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PRODUCED', 'OPEN')
       RETURNING *`,
      [jumboNumber, machineId, gradeId, targetGsm, targetBf, usableDeckleMm, grossWeightKg, coreTareKg]
    );
    const jumbo = jRows[0];
    assert(jumbo.id != null && parseFloat(jumbo.net_weight_kg) === 4350.000, `Mother Reel created: ${jumbo.jumbo_number} (Net Wt: ${jumbo.net_weight_kg} kg, Status: ${jumbo.reconciliation_status})`);

    // 4. Shopfloor Slitting: Scale Authority & Weighbridge Entry
    console.log('\n--- Step 4: Shopfloor Slitting Weighbridge Capture (4 Finished Reels) ---');
    const scaleWeights = [
      { pos: 1, letter: 'A', width: 1200, weight: 1968.750, so_id: so.id },
      { pos: 2, letter: 'B', width: 600,  weight: 984.375,  so_id: null },
      { pos: 3, letter: 'C', width: 500,  weight: 820.312,  so_id: null },
      { pos: 4, letter: 'D', width: 300,  weight: 492.188,  so_id: null }
    ];

    let totalSlitWeight = 0;
    for (const sw of scaleWeights) {
      const childReelNumber = `${jumbo.jumbo_number.replace('MK-JMB', 'MK-FIN')}-${sw.letter}`;
      const barcode = `MK-BAR-${childReelNumber}-${Date.now()}`;
      totalSlitWeight += sw.weight;

      const { rows: srRows } = await client.query(
        `INSERT INTO slit_reels 
           (reel_number, jumbo_reel_id, pattern_id, cut_position, sales_order_id, width_mm, planned_weight_kg, actual_weight_kg, barcode, quality_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED')
         RETURNING *`,
        [childReelNumber, jumbo.id, pattern.id, sw.pos, sw.so_id, sw.width, sw.weight, sw.weight, barcode]
      );
      assert(srRows[0].reel_number === childReelNumber, `  Child Reel Weighed: ${childReelNumber} (${sw.weight} kg on scale)`);
    }
    assert(totalSlitWeight === 4265.625, `Total Finished Slit Reels Weight: ${totalSlitWeight} kg`);

    // 5. Log Scrap / Edge Trim & Test Automated Mass Balance Trigger
    console.log('\n--- Step 5: Log Trim & Broke Scrap ➔ Trigger Mass Balance Reconciliation ---');
    const edgeTrimKg = 70.000;
    const brokeKg = 10.000;
    const coreScrapKg = 4.375;
    const totalScrap = edgeTrimKg + brokeKg + coreScrapKg; // 84.375 kg
    // Total accounted = 4265.625 + 84.375 = 4350.000 kg == netWeightKg (0.00 kg difference)

    await client.query(
      `INSERT INTO slitting_waste_log (jumbo_reel_id, edge_trim_kg, rewinder_broke_kg, core_waste_kg, logged_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [jumbo.id, edgeTrimKg, brokeKg, coreScrapKg, userId]
    );

    // Verify trigger reconciled the jumbo
    const { rows: reconciledJumbo } = await client.query('SELECT * FROM jumbo_reels WHERE id = $1', [jumbo.id]);
    assert(reconciledJumbo[0].reconciliation_status === 'BALANCED', `Mass Balance Trigger Result: ${reconciledJumbo[0].reconciliation_status} (Variance: ${reconciledJumbo[0].variance_pct}%)`);
    assert(reconciledJumbo[0].status === 'SLIT_COMPLETED', `Jumbo Reel Status updated to: ${reconciledJumbo[0].status}`);

    // 6. Test VARIANCE_HELD path (> 0.5% breach) and Plant Head Override
    console.log('\n--- Step 6: Test VARIANCE_HELD Gate and Plant Head Supervisor Override ---');
    const jumbo2Number = `MK-JMB-TEST-BREACH-${Date.now().toString().slice(-6)}`;
    const { rows: j2Rows } = await client.query(
      `INSERT INTO jumbo_reels 
         (jumbo_number, machine_id, grade_id, gsm_actual, bf_actual, deckle_width_mm, gross_weight_kg, core_tare_weight_kg, status, reconciliation_status)
       VALUES ($1, $2, $3, $4, $5, $6, 4000.000, 100.000, 'PRODUCED', 'OPEN')
       RETURNING *`,
      [jumbo2Number, machineId, gradeId, targetGsm, targetBf, usableDeckleMm]
    );
    const jumbo2 = j2Rows[0]; // Net wt = 3900 kg

    // Log only 3600 kg output + 50 kg trim = 3650 kg (Difference = 250 kg / 6.41% > 0.5%)
    await client.query(
      `INSERT INTO slit_reels (reel_number, jumbo_reel_id, cut_position, width_mm, planned_weight_kg, actual_weight_kg, barcode)
       VALUES ($1, $2, 1, 2000, 3600, 3600, $3)`,
      [`${jumbo2Number}-A`, jumbo2.id, `MK-BAR-${jumbo2Number}-A`]
    );
    await client.query(
      `INSERT INTO slitting_waste_log (jumbo_reel_id, edge_trim_kg, rewinder_broke_kg, core_waste_kg, logged_by)
       VALUES ($1, 50, 0, 0, $2)`,
      [jumbo2.id, userId]
    );

    const { rows: breachedJumbo } = await client.query('SELECT * FROM jumbo_reels WHERE id = $1', [jumbo2.id]);
    assert(breachedJumbo[0].reconciliation_status === 'VARIANCE_HELD', `Breached Roll correctly held in status: ${breachedJumbo[0].reconciliation_status} (Variance: ${breachedJumbo[0].variance_pct}%)`);

    // Plant Head Override
    await client.query(
      `UPDATE jumbo_reels 
       SET reconciliation_status = 'OVERRIDDEN', status = 'SLIT_COMPLETED',
           override_reason = 'Calibrated weighbridge discrepancy verified by Plant Head',
           override_by = $1
       WHERE id = $2`,
      [userId, jumbo2.id]
    );
    const { rows: overriddenJumbo } = await client.query('SELECT * FROM jumbo_reels WHERE id = $1', [jumbo2.id]);
    assert(overriddenJumbo[0].reconciliation_status === 'OVERRIDDEN', `Supervisor Override Successful: Status = ${overriddenJumbo[0].reconciliation_status}, Reason = "${overriddenJumbo[0].override_reason}"`);

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passed}/${total} LIFECYCLE TESTS PASSED PERFECTLY!`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

testLifecycle();
