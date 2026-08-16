const router = require('express').Router();
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');

// GET /api/dashboard — all KPIs in one call
router.get('/', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    const [
      productionToday,
      productionMonth,
      shiftBreakdown,
      reelStatus,
      stockAlerts,
      pendingIndents,
      pendingGRN,
      openBreakdowns,
      pendingDispatches,
      pendingSO,
      qualityStats,
      utilityToday,
      ehsIncidents,
      hrAttendance,
      maintenanceExtra,
      inventoryExtra,
      purchaseExtra,
      salesExtra,
      hrExtra,
      ehsExtra,
      financeExtra,
      lowStockCount,
      storeExtra,
      purchaseVendorPerf,
      purchasePoCycle,
      purchasePoAging,
      indentFlow,
    ] = await Promise.all([
      // Today's production
      pool.query(
        `SELECT COALESCE(SUM(weight_kg),0) AS total_kg,
                COUNT(*) AS total_reels,
                COALESCE(AVG(efficiency_pct),0) AS avg_efficiency,
                COALESCE(AVG(moisture_pct),0) AS avg_moisture,
                COALESCE(AVG(gsm),0) AS avg_gsm,
                COALESCE(SUM(downtime_min),0) AS total_downtime
         FROM reels WHERE DATE(start_time) = $1`,
        [today]
      ),
      // Month production
      pool.query(
        `SELECT COALESCE(SUM(weight_kg),0) AS total_kg, COUNT(*) AS total_reels
         FROM reels WHERE DATE(start_time) >= $1`,
        [monthStart]
      ),
      // Shift breakdown today
      pool.query(
        `SELECT s.shift_type,
                COALESCE(SUM(r.weight_kg),0) AS production_kg,
                COUNT(r.id) AS reels,
                COALESCE(AVG(r.efficiency_pct),0) AS efficiency
         FROM shifts s
         LEFT JOIN reels r ON r.shift_id = s.id
         WHERE s.date = $1
         GROUP BY s.shift_type`,
        [today]
      ),
      // Reel status counts
      pool.query(
        `SELECT status, COUNT(*) AS count FROM reels
         WHERE DATE(start_time) >= $1 GROUP BY status`,
        [monthStart]
      ),
      // Low stock alerts
      pool.query(
        `SELECT m.code, m.name, m.current_stock, m.reorder_level, m.uom,
                mc.name AS category
         FROM materials m
         JOIN material_categories mc ON m.category_id = mc.id
         WHERE m.current_stock <= m.reorder_level AND m.is_active = true
         ORDER BY (m.current_stock / NULLIF(m.reorder_level,0))
         LIMIT 10`
      ),
      // Pending indents
      pool.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total_value),0) AS value FROM indents
         WHERE status IN ('Submitted','L1 Approved','L2 Approved')`
      ),
      // Pending GRN approvals
      pool.query(
        `SELECT COUNT(*) AS count FROM grn WHERE status IN ('Received','QC Pending')`
      ),
      // Open breakdowns
      pool.query(
        `SELECT COUNT(*) AS count FROM maintenance_logs
         WHERE status != 'Completed' AND date >= $1`,
        [monthStart]
      ),
      // Pending dispatches
      pool.query(
        `SELECT COUNT(*) AS count FROM dispatch_orders WHERE status IN ('Loading','Loaded')`
      ),
      // Pending sales orders
      pool.query(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(qty_mt - fulfilled_mt),0) AS pending_mt
         FROM sales_orders WHERE status IN ('Pending','In Production')`
      ),
      // Quality stats this month
      pool.query(
        `SELECT result, COUNT(*) AS count FROM quality_tests
         WHERE DATE(test_date) >= $1 GROUP BY result`,
        [monthStart]
      ),
      // Utility today (including DG Power)
      pool.query(
        `SELECT COALESCE(SUM(power_units),0) AS power,
                COALESCE(SUM(dg_units),0) AS dg_power,
                COALESCE(SUM(steam_generated_mt),0) AS steam,
                COALESCE(SUM(fresh_water_kl),0) AS water,
                COALESCE(SUM(coal_consumed_kg),0) AS coal
         FROM utility_readings WHERE date = $1`,
        [today]
      ),
      // EHS Incidents this month
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE severity IN ('High','Critical')) AS critical_count,
                COUNT(*) FILTER (WHERE status = 'Open') AS open_count
         FROM ehs_incidents WHERE date >= $1`,
        [monthStart]
      ),
      // HR attendance present count today
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status IN ('Present','Late')) AS present_count
         FROM attendance WHERE date = $1`,
        [today]
      ),
      // Maintenance extra: pending PM, completed this month, avg MTTR (hrs)
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('Scheduled','Pending') AND next_due <= $1::date + INTERVAL '7 days') AS pending_pm,
           (SELECT COUNT(*) FROM maintenance_logs WHERE status='Completed' AND date >= $1) AS completed_month,
           (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resumed_at - event_time))/3600),0) FROM machine_events WHERE resumed_at IS NOT NULL AND event_time >= $1) AS avg_mttr
         FROM maintenance_schedule`,
        [monthStart]
      ),
      // Inventory extra: total items + total stock value
      pool.query(
        `SELECT COUNT(*) AS total_items, COALESCE(SUM(current_stock * unit_price),0) AS total_value
         FROM materials WHERE is_active = true`
      ),
      // Purchase extra: open POs, POs this month, pending payments
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status NOT IN ('Cancelled')) AS open_pos,
           COUNT(*) FILTER (WHERE date >= $1) AS month_pos,
           COALESCE(SUM(grand_total) FILTER (WHERE status NOT IN ('Cancelled')),0) AS open_po_value
         FROM purchase_orders`,
        [monthStart]
      ),
      // Sales/dispatch extra: today/month dispatched MT, active customers, overdue orders
      pool.query(
        `SELECT
           (SELECT COALESCE(SUM(total_weight_kg)/1000.0,0) FROM dispatch_orders WHERE date = $1) AS today_mt,
           (SELECT COALESCE(SUM(total_weight_kg)/1000.0,0) FROM dispatch_orders WHERE date >= $2) AS month_mt,
           (SELECT COUNT(DISTINCT customer_id) FROM sales_orders WHERE date >= $2) AS active_customers,
           (SELECT COUNT(*) FROM sales_orders WHERE status IN ('Pending','In Production') AND delivery_date < $1) AS overdue`,
        [today, monthStart]
      ),
      // HR extra: absent, on leave, total employees, pending payroll, pending leaves
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM employees WHERE is_active=true) AS total_employees,
           (SELECT COUNT(*) FROM attendance WHERE date=$1 AND status='Absent') AS absent_today,
           (SELECT COUNT(*) FROM attendance WHERE date=$1 AND status='Leave') AS on_leave,
           (SELECT COUNT(*) FROM payroll_runs WHERE status IN ('Draft','Processing')) AS pending_payroll,
           (SELECT COUNT(*) FROM leave_applications WHERE status='Pending') AS pending_leaves`,
        [today]
      ),
      // EHS extra: near misses, LTI-free days, closed this month, open corrective actions
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE incident_type='Near Miss' AND date >= $1) AS near_misses,
           COUNT(*) FILTER (WHERE status='Closed' AND date >= $1) AS closed_month,
           COUNT(*) FILTER (WHERE status != 'Closed') AS open_actions,
           (SELECT COALESCE(EXTRACT(DAY FROM (NOW() - MAX(date))),0) FROM ehs_incidents WHERE severity IN ('High','Critical')) AS lti_free_days
         FROM ehs_incidents`,
        [monthStart]
      ),
      // Finance extra: open PO value (also surfaced under finance for FinanceDashboard)
      pool.query(
        `SELECT COALESCE(SUM(grand_total),0) AS open_po_value FROM purchase_orders WHERE status NOT IN ('Cancelled')`
      ),
      // True low-stock alert count (unbounded — the stockAlerts query above is LIMIT 10 for display only)
      pool.query(
        `SELECT COUNT(*) AS count FROM materials
         WHERE current_stock <= reorder_level AND is_active = true`
      ),
      // Store extra: dead-stock value/items (no issue/out/return/transfer movement in last 90 days)
      pool.query(
        `SELECT COUNT(*) AS dead_stock_items,
                COALESCE(SUM(m.current_stock * m.unit_price),0) AS dead_stock_value
         FROM materials m
         WHERE m.is_active = true AND NOT EXISTS (
           SELECT 1 FROM stock_ledger sl WHERE sl.material_id = m.id
           AND sl.transaction_type IN ('issue','out','return_to_vendor','transfer')
           AND sl.date >= CURRENT_DATE - INTERVAL '90 days'
         )`
      ),
      // Purchase extra: vendor performance snapshot (90d) — on-time %, reject %
      pool.query(
        `SELECT
           ROUND(100.0 * COUNT(DISTINCT po.id) FILTER (WHERE g.date <= po.delivery_date)
                 / NULLIF(COUNT(DISTINCT po.id) FILTER (WHERE g.id IS NOT NULL), 0), 1) AS on_time_pct,
           ROUND(100.0 * COALESCE(SUM(gi.rejected_qty) FILTER (WHERE gi.rejected_qty IS NOT NULL), 0)
                 / NULLIF(SUM(gi.received_qty), 0), 2) AS reject_pct
         FROM purchase_orders po
         LEFT JOIN grn g ON g.po_id = po.id
         LEFT JOIN grn_items gi ON gi.grn_id = g.id
         WHERE po.date >= CURRENT_DATE - INTERVAL '90 days'`
      ),
      // Purchase extra: average PO->GRN cycle time in days (90d) — date - date is integer, no EXTRACT(EPOCH) needed
      pool.query(
        `SELECT ROUND(AVG(g.date - po.date)::numeric, 1) AS avg_cycle_days
         FROM purchase_orders po JOIN grn g ON g.po_id = po.id
         WHERE po.date >= CURRENT_DATE - INTERVAL '90 days'`
      ),
      // Purchase extra: pending PO aging buckets (mirrors reports.js purchase-detailed pattern)
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE (CURRENT_DATE - po.date) <= 15) AS bucket_0_15,
           COUNT(*) FILTER (WHERE (CURRENT_DATE - po.date) BETWEEN 16 AND 30) AS bucket_16_30,
           COUNT(*) FILTER (WHERE (CURRENT_DATE - po.date) BETWEEN 31 AND 60) AS bucket_31_60,
           COUNT(*) FILTER (WHERE (CURRENT_DATE - po.date) > 60) AS bucket_60_plus
         FROM purchase_orders po
         WHERE po.status NOT IN ('Closed','Cancelled','Received')`
      ),
      // Indent flow health: high-value indents pending human approval + tier-1 flow confirmation
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('Submitted','L1 Approved','L2 Approved') AND total_value > 10000) AS pending_high_value_count,
           COALESCE(SUM(total_value) FILTER (WHERE status IN ('Submitted','L1 Approved','L2 Approved') AND total_value > 10000), 0) AS pending_high_value_value,
           COUNT(*) FILTER (WHERE status = 'Submitted' AND total_value <= 10000) AS tier1_awaiting_auto_advance,
           COUNT(*) FILTER (WHERE status NOT IN ('Draft','Closed','Rejected','Cancelled','Issued','PO Created') AND created_at < NOW() - INTERVAL '2 days') AS stuck_over_2d
         FROM indents`
      ),
    ]);

    const isStoreUser = req.user?.dept_code === 'STORE' || ['Store Management', 'Raw Material Store', 'Inventory', 'Store'].includes(req.user?.department);
    const isPlantHeadOrAdmin = (req.user?.role_level || 1) >= 4;

    // Security Isolation: For Store Users, return ONLY store & inventory data without leaking HR, Finance, or Sales!
    if (isStoreUser && !isPlantHeadOrAdmin) {
      return res.json({
        success: true,
        data: {
          inventory: {
            low_stock_alerts: stockAlerts.rows,
            alert_count: parseInt(lowStockCount.rows[0]?.count || 0),
            total_items: parseInt(inventoryExtra.rows[0]?.total_items || 0),
            total_value: parseFloat(inventoryExtra.rows[0]?.total_value || 0),
            dead_stock_items: parseInt(storeExtra.rows[0]?.dead_stock_items || 0),
            dead_stock_value: parseFloat(storeExtra.rows[0]?.dead_stock_value || 0),
          },
          purchase: {
            pending_indents: parseInt(pendingIndents.rows[0].count),
            pending_indents_value: parseFloat(pendingIndents.rows[0].value || 0),
            pending_grn: parseInt(pendingGRN.rows[0].count),
          }
        }
      });
    }

    res.json({
      success: true,
      data: {
        production: {
          today: productionToday.rows[0],
          month: productionMonth.rows[0],
          shifts: shiftBreakdown.rows,
          reel_status: reelStatus.rows,
        },
        inventory: {
          low_stock_alerts: stockAlerts.rows,
          alert_count: parseInt(lowStockCount.rows[0]?.count || 0),
          total_items: parseInt(inventoryExtra.rows[0]?.total_items || 0),
          total_value: parseFloat(inventoryExtra.rows[0]?.total_value || 0),
          dead_stock_items: parseInt(storeExtra.rows[0]?.dead_stock_items || 0),
          dead_stock_value: parseFloat(storeExtra.rows[0]?.dead_stock_value || 0),
        },
        purchase: {
          pending_indents: parseInt(pendingIndents.rows[0].count),
          pending_indents_value: parseFloat(pendingIndents.rows[0].value || 0),
          pending_grn: parseInt(pendingGRN.rows[0].count),
          open_pos: parseInt(purchaseExtra.rows[0]?.open_pos || 0),
          month_pos: parseInt(purchaseExtra.rows[0]?.month_pos || 0),
          pending_payments: parseInt(pendingGRN.rows[0].count),
          vendor_on_time_pct: parseFloat(purchaseVendorPerf.rows[0]?.on_time_pct || 0),
          vendor_reject_pct: parseFloat(purchaseVendorPerf.rows[0]?.reject_pct || 0),
          avg_po_cycle_days: parseFloat(purchasePoCycle.rows[0]?.avg_cycle_days || 0),
          po_aging: {
            bucket_0_15: parseInt(purchasePoAging.rows[0]?.bucket_0_15 || 0),
            bucket_16_30: parseInt(purchasePoAging.rows[0]?.bucket_16_30 || 0),
            bucket_31_60: parseInt(purchasePoAging.rows[0]?.bucket_31_60 || 0),
            bucket_60_plus: parseInt(purchasePoAging.rows[0]?.bucket_60_plus || 0),
          },
          pending_high_value_indents: parseInt(indentFlow.rows[0]?.pending_high_value_count || 0),
          pending_high_value_indents_value: parseFloat(indentFlow.rows[0]?.pending_high_value_value || 0),
          tier1_awaiting_auto_advance: parseInt(indentFlow.rows[0]?.tier1_awaiting_auto_advance || 0),
          indents_stuck_over_2d: parseInt(indentFlow.rows[0]?.stuck_over_2d || 0),
        },
        maintenance: {
          open_breakdowns: parseInt(openBreakdowns.rows[0].count),
          pending_pm: parseInt(maintenanceExtra.rows[0]?.pending_pm || 0),
          completed_month: parseInt(maintenanceExtra.rows[0]?.completed_month || 0),
          avg_mttr: parseFloat(maintenanceExtra.rows[0]?.avg_mttr || 0),
        },
        dispatch: {
          pending: parseInt(pendingDispatches.rows[0].count),
          today_mt: parseFloat(salesExtra.rows[0]?.today_mt || 0),
          month_mt: parseFloat(salesExtra.rows[0]?.month_mt || 0),
        },
        sales: {
          pending_orders: parseInt(pendingSO.rows[0].count),
          pending_mt: pendingSO.rows[0].pending_mt,
          active_customers: parseInt(salesExtra.rows[0]?.active_customers || 0),
          overdue: parseInt(salesExtra.rows[0]?.overdue || 0),
        },
        quality: {
          stats: qualityStats.rows,
        },
        utility: {
          today: {
            ...utilityToday.rows[0],
            dg_power: utilityToday.rows[0]?.dg_power || 0,
            specific_power: productionToday.rows[0]?.total_kg > 0
              ? (parseFloat(utilityToday.rows[0]?.power || 0) / (parseFloat(productionToday.rows[0].total_kg) / 1000))
              : 0,
          }
        },
        safety: {
          critical_incidents: parseInt(ehsIncidents.rows[0]?.critical_count || 0),
          open_incidents: parseInt(ehsIncidents.rows[0]?.open_count || 0),
          near_misses: parseInt(ehsExtra.rows[0]?.near_misses || 0),
          closed_month: parseInt(ehsExtra.rows[0]?.closed_month || 0),
          open_actions: parseInt(ehsExtra.rows[0]?.open_actions || 0),
          lti_free_days: parseInt(ehsExtra.rows[0]?.lti_free_days || 0),
        },
        hr: {
          present_today: parseInt(hrAttendance.rows[0]?.present_count || 0),
          absent_today: parseInt(hrExtra.rows[0]?.absent_today || 0),
          on_leave: parseInt(hrExtra.rows[0]?.on_leave || 0),
          total_employees: parseInt(hrExtra.rows[0]?.total_employees || 0),
          pending_payroll: parseInt(hrExtra.rows[0]?.pending_payroll || 0),
          pending_leaves: parseInt(hrExtra.rows[0]?.pending_leaves || 0),
        },
        finance: {
          open_po_value: parseFloat(financeExtra.rows[0]?.open_po_value || 0),
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
