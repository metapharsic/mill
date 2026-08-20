export const PHASE_GROUPS = [
  {
    id: 'core',
    title: 'Core Build Phases',
    color: '#1b1b1d',
    phases: [
      { id: 'ph1',  title: 'Phase 1 — Auth & Users',       status: 'Done', progress: 100, summary: 'Login, JWT, roles 1-5, departments, audit log.',        items: ['Login / JWT', 'Role levels 1-5', 'Department assignment', 'Audit log table'] },
      { id: 'ph2',  title: 'Phase 2 — Master Data',         status: 'Done', progress: 100, summary: 'Customers, vendors, materials, grades, machines.',       items: ['Materials master', 'Vendors', 'Customers', 'Grades & machines'] },
      { id: 'ph3',  title: 'Phase 3 — Production',          status: 'Done', progress: 100, summary: 'Shifts, reels, downtime, machine efficiency.',            items: ['Shift records', 'Reel tracking', 'Downtime log', 'OEE'] },
      { id: 'ph4',  title: 'Phase 4 — Inventory',           status: 'Done', progress: 100, summary: 'Stock ledger, GRN, bin tracking, reorder alerts.',       items: ['Stock movement', 'GRN', 'Bin tracking', 'Reorder alerts'] },
      { id: 'ph5',  title: 'Phase 5 — Procurement',         status: 'Done', progress: 100, summary: 'Indent, PO, vendor reconciliation, GRN workflow.',       items: ['Purchase indent', 'PO creation', 'GRN', 'Approval routing'] },
      { id: 'ph6',  title: 'Phase 6 — Quality',             status: 'Done', progress: 100, summary: 'QC tests, samples, nonconformance, reel release.',       items: ['Inspection entry', 'Test results', 'NC tracking', 'QC reports'] },
      { id: 'ph7',  title: 'Phase 7 — Maintenance',         status: 'Done', progress: 100, summary: 'PM schedules, breakdowns, spare usage.',                 items: ['PM plans', 'Breakdown log', 'Spare parts', 'Worker tasks'] },
      { id: 'ph8',  title: 'Phase 8 — Sales',               status: 'Done', progress: 100, summary: 'Orders, dispatch, invoicing, customer follow-up.',       items: ['Order booking', 'Dispatch plan', 'Invoices', 'Sales reports'] },
      { id: 'ph9',  title: 'Phase 9 — Utility',             status: 'Done', progress: 100, summary: 'Power, steam, coal, water, boiler tracking.',            items: ['Utility entry', 'Consumption trends', 'Cost tracking', 'Alerts'] },
      { id: 'ph10', title: 'Phase 10 — Reports',            status: 'Done', progress: 100, summary: 'Cross-module reports and analytics.',                    items: ['Production reports', 'Inventory reports', 'Finance summary', 'HR reports'] },
      { id: 'ph11', title: 'Phase 11 — HR',                 status: 'Done', progress: 100, summary: 'Employees, attendance, leave, payroll.',                 items: ['Employee master', 'Attendance', 'Leave management', 'Payroll'] },
      { id: 'ph12', title: 'Phase 12 — Finance',            status: 'Done', progress: 100, summary: 'AR/AP, stock valuation, monthly summary.',               items: ['AR/AP entries', 'Stock valuation', 'Monthly summary', 'Credit control'] },
      { id: 'ph14', title: 'Phase 14 — Extended Modules',   status: 'Done', progress: 100, summary: 'Store, Scrap, FG Warehouse, Security, Lab, EHS, Admin.', items: ['Store module', 'Scrap module', 'FG Warehouse', 'Security, Lab, EHS, Admin'] },
    ]
  },
  {
    id: 'features',
    title: 'Feature Enhancements',
    color: '#f4c84b',
    phases: [
      { id: 'p1', title: 'P1 — Store Indent → Issue',      status: 'Done',    progress: 100, summary: 'Full indent lifecycle: raise → approve → issue → close. Role-based tabs, timeline log.',  items: ['store_indents table (M5)', 'requireStore guard', '10 indent routes', 'Role-based Store tabs'] },
      { id: 'p2', title: 'P2 — Dept Categories (M4)',      status: 'Done',    progress: 100, summary: 'Group 20 depts into 6 categories. Approval thresholds in system_settings.',               items: ['migration_dept_categories.sql', 'category column on departments', 'must_change_password flag', 'Approval thresholds in system_settings'] },
      { id: 'p3', title: 'P3 — Per-Dept Logins (M6)',      status: 'Done',    progress: 100, summary: '20 dept heads + Plant Head + Store desk. Force password change on first login.',           items: ['seed_logins.sql (22 accounts)', 'Head@1234 default', 'must_change_password=true', 'ForceChangePassword gate in frontend'] },
      { id: 'p4', title: 'P4 — Approver Hierarchy',        status: 'Done',    progress: 100, summary: 'Value-based approval matrix. Tier 1 <₹10k, Tier 2 ₹10k–₹1L, Tier 3 >₹1L. Emergency bypass.',              items: ['approval_matrix table (M7)', 'Tier-aware L1/L2/L3 routes', 'Dept-head guard on L2', 'Emergency 2h bypass for Urgent indents'] },
      { id: 'p5', title: 'P5 — Admin Footstep View',       status: 'Done',    progress: 100, summary: 'Global audit feed + approver control tower. Routes live, Footsteps + Approvers tabs in Admin.',             items: ['GET /admin/footsteps (with filters)', 'GET /admin/approvers', 'Per-user & per-dept trail', 'Footsteps + Approvers tab in Admin'] },
      { id: 'p6', title: 'P6 — Admin User Management',     status: 'Done',    progress: 100, summary: 'Admin creates/assigns/resets/deactivates logins. Full CRUD in Admin Users tab.',          items: ['POST /admin/users (create)', 'PUT /admin/users/:id (reassign)', 'PUT /admin/users/:id/reset-password', 'PUT /admin/users/:id/deactivate + activate'] },
      { id: 'p7', title: 'P7 — PIIMAS (Indent 2.0)',       status: 'Done',    progress: 100, summary: 'Full indent lifecycle with acknowledgment, KPI before/after, photo proof, analytics, calendar, escalation cron, notifications.',  items: ['✓ DB migration (M_PIIMAS)', '✓ Backend routes (all 15 endpoints)', '✓ Frontend 7-tab Indent.jsx', '✓ Sidebar label update', '✓ Photo URL on ack form', '✓ Escalation cron (2h, >24h pending → notify dept head, >48h auto-escalate)', '✓ Mobile-responsive ack screen (auto-fill grid, textarea, full-width btn)'] },
      { id: 'p8', title: 'P8 — Indent Lifecycle Stabilization', status: 'Done', progress: 100, summary: 'Fixed indents_status_check constraint, close/issue/acknowledge route bugs (SQL param, stock floor guard, transaction+race condition, FOR UPDATE+aggregate error), and added Approve (L1/L2) + Acknowledge UI in Indent.jsx wired to real endpoints.', items: ['migration_partially_issued_and_ledger_fix.sql widened status check', 'indent.js close route param bug fixed', 'indent.js issue route stock floor guard', 'indent.js acknowledge route transaction/race fix', 'Indent.jsx Approve buttons + Acknowledge tab'] },
    ]
  },
  {
    id: 'sections',
    title: 'Plant Sections Module (Ph15)',
    color: '#d97706',
    phases: [
      { id: 'ph15a', title: 'Ph15-A — DB Migration M11',     status: 'Done', progress: 100, summary: '5 tables created: plant_sections (21 seeded), section_equipment, section_process_readings, section_alarms, section_sops, section_kpi_snapshots.',   items: ['plant_sections (21 section seed)', 'section_equipment', 'section_process_readings (time-series, indexed)', 'section_alarms (active index)', 'section_sops', 'section_kpi_snapshots (unique hourly index)'] },
      { id: 'ph15b', title: 'Ph15-B — Backend routes/sections.js', status: 'Done', progress: 100, summary: '9 endpoints mounted at /api/sections: section list, readings, alarms, SOPs, equipment CRUD, KPI snapshot aggregator.',             items: ['GET /api/sections', 'GET /sections/:code + equipment', 'POST /sections/:code/readings', 'GET/POST /sections/:code/alarms', 'PUT alarms ack + resolve', 'GET /sections/all/kpi-snapshot'] },
      { id: 'ph15c', title: 'Ph15-C — PlantSection.jsx + AllSections.jsx', status: 'Done', progress: 100, summary: 'Single parameterized PlantSection.jsx wired in App.jsx. AllSections aggregator. Navigation via sections- key prefix.', items: ['SectionHeader + KPIStrip', 'EquipmentTable', 'ProcessReadingsForm', 'AlarmPanel + ack button', 'SOPAccordion', 'App.jsx routing: sections-* → PlantSection'] },
      { id: 'ph15d', title: 'Ph15-D — Sidebar Plant Sections group', status: 'Done', progress: 100, summary: '"Plant Sections" NAV group with 21 entries added. Starts collapsed. filterNav allows L1+ for all sections- keys.',               items: ['21 nav items with lucide icons', 'Plant Sections group (starts collapsed)', 'permissions.js: sections-* → all users', 'groups array updated in Sidebar.jsx'] },
      { id: 'ph15e', title: 'Ph15-E — Alarm → Maintenance ACID link', status: 'Done', progress: 100, summary: 'Critical alarm auto-creates maintenance_logs + downtime_entries in single ACID transaction. maintenance_log_id backlinked.', items: ['ACID: alarm → maintenance_logs (Breakdown)', 'ACID: alarm → downtime_entries', 'UPDATE section_alarms SET maintenance_log_id', 'Implemented in routes/sections.js POST /alarms'] },
      { id: 'ph15f', title: 'Ph15-F — KPI Snapshot Cron',   status: 'Done', progress: 100, summary: 'Hourly cron in server.js upserts section_kpi_snapshots for all active sections. AllSections polls every 60s, PlantSection every 30s.', items: ['setInterval 3600s in server.js (.unref())', 'computeSectionKPISnapshot() per section', 'UPSERT on (section_id, date_trunc hour)', '30s poll PlantSection.jsx, 60s AllSections.jsx'] },
    ]
  },
  {
    id: 'hrms',
    title: 'HRMS Module (Ph16)',
    color: '#7c3aed',
    phases: [
      { id: 'ph16a', title: 'Ph16-A — DB Migration',          status: 'Done', progress: 100, summary: 'All HR migrations APPLIED (20 tables + seed). Fixed schema_migrations(version,…) bug that aborted ph16+holidays. employees expanded 21→44 cols. emp_id/is_dept_head/is_hr_admin flow through auth.', items: ['✓ migration_hrms_ph16.sql APPLIED (18 tables)', '✓ migrate_holidays_loans.sql APPLIED (holidays + employee_loans)', '✓ seed_leave_balances.sql APPLIED (5 balances)', '✓ migration_hrms_employee_cols.sql APPLIED (23 new employee cols + is_dept_head backfill)', '✓ auth.js + middleware extended: emp_id, is_dept_head, is_hr_admin', '✓ GET /employees/:id locked: tiered access + PII masking (was open leak)'] },
      { id: 'ph16b', title: 'Ph16-B — Self-Service API',      status: 'Done',    progress: 100, summary: '4 self-service endpoints in hr.js: GET /employees/me, /attendance/me, /payroll/me (PF/PT/TDS), /leaves/me (graceful fallback pre-Ph16).', items: ['GET /employees/me — own profile by user_id', 'GET /attendance/me — own attendance + summary', 'GET /payroll/me — payslips with PF/PT/TDS + YTD', 'GET /leaves/me — Ph16 or attendance fallback'] },
      { id: 'ph16c', title: 'Ph16-C — HR.jsx Role-Gated UI',  status: 'Done',    progress: 100, summary: 'HR.jsx complete: 15 tabs role-gated L1→L5. Self-service, apply leave, docs, onboarding, appraisals, training, separation, team tabs, payroll runs V2, employees CRUD.', items: ['Profile/Attendance/Leave Balance/Payslip — all L1+', 'Apply Leave (apply form + own applications + cancel)', 'My Documents, Onboarding checklist, Appraisals (self-rate), Training', 'Separation (initiate + clearance view)', 'Team Attendance + Team Leaves (L2+)', 'Employees CRUD + Payroll Runs V2 + Legacy Payroll (HR Admin/L5)'] },
      { id: 'ph16d', title: 'Ph16-D — Leave Application',     status: 'Done',    progress: 100, summary: '6 routes: apply, team view, my-applications, approve (ACID balance deduct + attendance mark), reject, cancel.', items: ['POST /leaves/apply (balance check)', 'GET /leaves/team (dept filter for L2, all for HR Admin)', 'GET /leaves/my-applications', 'PUT /:id/approve — ACID: deduct balance + mark attendance Leave', 'PUT /:id/reject + reason', 'PUT /:id/cancel (own pending only)'] },
      { id: 'ph16e', title: 'Ph16-E — Salary Structures',     status: 'Done',    progress: 100, summary: '5 routes: CRUD structures, assign to employee (closes prev). computeSalaryBreakdown() helper ready for Ph16-F.', items: ['GET /salary-structures (list)', 'POST /salary-structures (create)', 'PUT /salary-structures/:id (update)', 'GET /salary-structures/employee/:id (current assignment)', 'POST /salary-structures/assign (ACID: close prev, open new)', 'computeSalaryBreakdown() — basic→HRA/DA/Conv/Medical/Special/PF/ESIC/PT'] },
      { id: 'ph16f', title: 'Ph16-F — Payroll Engine V2',     status: 'Done',    progress: 100, summary: '6 routes: generate run (structure+attendance+LOP+OT+TDS slab), approve (L4), pay (L3), per-employee slip. ACID throughout.', items: ['POST /payroll/runs — ACID generate: structure→HRA/DA/PF/ESIC/PT/TDS slab', 'GET /payroll/runs — list all runs', 'GET /payroll/runs/:id — full detail + all employees', 'PUT /payroll/runs/:id/approve — L4 Plant Head', 'PUT /payroll/runs/:id/pay — L3 HR marks paid', 'GET /payroll/runs/:id/slip/:emp_id — individual payslip'] },
      { id: 'ph16g', title: 'Ph16-G — Attendance Regularization', status: 'Done', progress: 100, summary: '5 routes: employee submits correction request, supervisor team view (dept-filtered), ACID approve patches attendance record.', items: ['POST /attendance/regularize', 'GET /attendance/regularize/team (dept filter L2, all HR Admin/L4)', 'GET /attendance/regularize/my', 'PUT /:id/approve — ACID: compute hours + patch attendance + approve', 'PUT /:id/reject + reason'] },
      { id: 'ph16h', title: 'Ph16-H — Appraisal Cycle',        status: 'Done', progress: 100, summary: '7 routes: cycle CRUD (L3+), goal CRUD, self-rate (own), manager-rate (L3+, auto final = avg).', items: ['GET/POST/PUT /appraisals/cycles', 'GET /appraisals/goals (own or team L2+)', 'POST /appraisals/goals (L3+ sets for employee)', 'PUT /:id/self-rate (employee)', 'PUT /:id/manager-rate (L3+, final=avg if not supplied)'] },
      { id: 'ph16i', title: 'Ph16-I — Training Module',         status: 'Done', progress: 100, summary: '6 routes: program CRUD (L3+), nominee list, bulk nominate (L2+), attendance mark with feedback.', items: ['GET /training (status+year filter)', 'POST /training (L3+)', 'PUT /training/:id (status/venue)', 'GET /training/:id/attendance nominees', 'POST /training/:id/nominate bulk', 'PUT /training/:id/attendance/:ta_id status+feedback'] },
      { id: 'ph16j', title: 'Ph16-J — Documents Vault',         status: 'Done', progress: 100, summary: '3 routes: list with confidential gate (HR Admin/L4 only see confidential), upload, delete.', items: ['GET /documents/:emp_id (conf filter for non-HR)', 'POST upload doc record (L3+)', 'DELETE doc record (L3+)'] },
      { id: 'ph16k', title: 'Ph16-K — Onboarding Checklist',    status: 'Done', progress: 100, summary: '3 routes: init from master (seeds 20 tasks with DOJ-relative due dates), get with summary %, update task status.', items: ['POST /onboarding/:emp_id/init → seeds 20 tasks + due dates from DOJ', 'GET /onboarding/:emp_id → checklist + {total,done,pending,pct}', 'PUT /onboarding/:emp_id/:item_id → status update'] },
      { id: 'ph16l', title: 'Ph16-L — F&F + Separation',        status: 'Done', progress: 100, summary: '6 routes: initiate (gratuity=15/26×basic×years, seeds clearance items), list, clearance CRUD, approve, complete (F&F + deactivate employee).', items: ['POST /separation → gratuity calc + seed_clearance_items()', 'GET /separation (own or all for HR/L4)', 'GET /separation/:id/clearance + summary', 'PUT clearance/:item_id (dept marks cleared)', 'PUT /:id/approve (L3+)', 'PUT /:id/complete → net F&F + deactivate employee'] },
    ]
  },
  {
    id: 'dpr',
    title: 'Daily Performance Statement (Ph17)',
    color: '#0369a1',
    phases: [
      { id: 'ph17a', title: 'Ph17-A — DPR Artifact + Engine', status: 'Done', progress: 100, summary: 'Consolidated Daily Production Report. 4 tables + assembler route. All per-ton ratios computed server-side off PM/C prod. Verified against real 29/06 mill report (Starch 30.30, Power 237.27, Steam 1.66, Husk 0.290).', items: ['daily_production_reports + dpr_gsm_breakup + dpr_chemical_lines + dpr_downtime_lines', 'POST/GET /api/production/daily-report (ACID upsert + assemble)', 'GET /daily-report/autofill — pulls reels+utility+chemical+furnish (no double entry)', 'kg/ton · unit/ton · steam/ton ratios server-side'] },
      { id: 'ph17b', title: 'Ph17-B — Feeder Artifacts + Variance', status: 'Done', progress: 100, summary: 'Filled the 3 gaps blocking auto-assembly: furnish_mix_log (was missing), downtime_reason_codes master (coded, was free-text), dpr_grade_standards (per-ton norms → variance + ALERT/OK status).', items: ['furnish_mix_log + GET/POST /furnish (Raw Material / Pulp)', 'downtime_reason_codes master (10 seeded) + GET route', 'dpr_grade_standards (norms) → variance vs standard', 'assembleDPR computes variance + ALERT status per chemical + power/steam/husk/yield'] },
      { id: 'ph17c', title: 'Ph17-C — Daily Report UI + Sidebar', status: 'Done', progress: 100, summary: 'DailyReport.jsx viewer wired into Operations sidebar group. Read-first statement with variance badges + "Assemble from shop floor" button. Plant-head approve.', items: ['DailyReport.jsx (KPI + GSM + downtime + chemical variance + furnish/power/boiler)', 'Sidebar Operations: Daily Report nav', 'App.jsx route + permissions (Production/Utility/Quality)', '⚡ Assemble button → autofill → POST draft'] },
      { id: 'ph17d', title: 'Ph17-D — Capture Completion', status: 'Done', progress: 100, summary: 'Close the 4 capture holes blocking auto-assembly (validation gaps 2,3,4,11): furnish entry form, coded downtime dropdown, reel BF/deckle, reject reason.', items: ['Furnish entry form (backend ready, no UI) — gap #2', 'Downtime reason-code dropdown at capture (master unused) — gap #3', 'reels.bf / deckle column (grade = GSM/BF) — gap #4', 'Reject/trim reason on reel — gap #11'] },
      { id: 'ph17e', title: 'Ph17-E — Grade & Master Fidelity', status: 'Done', progress: 100, summary: 'Per-grade standards (not one DEFAULT) + add missing chemicals to materials master (validation gaps 5,6).', items: ['Seed per-grade dpr_grade_standards — gap #5', 'Add Deformer / SE Bond 102 / Sigmaexor ETP to materials — gap #6'] },
      { id: 'ph17f', title: 'Ph17-F — Utility / Boiler Depth', status: 'Done', progress: 100, summary: 'Fix coal↔husk semantics + add feed-water/flue/efficiency; per-shift DPR split (validation gaps 7,9).', items: ['Rename/add husk, feed_water, flue_gas, boiler_efficiency — gap #7', 'Per-shift (day/night) DPR breakdown — gap #9'] },
      { id: 'ph17g', title: 'Ph17-G — Alerts & Cost', status: 'Done', progress: 100, summary: 'Variance breach → notifications; cost impact ₹/ton (validation gaps 8,10).', items: ['Variance ALERT → notifications (Starch/Power breach) — gap #8', 'Cost impact ₹/ton from power/husk/chemical rates — gap #10'] },
      { id: 'ph17h', title: 'Ph17-H — Daily Capture Screen + Adoption', status: 'Done', progress: 100, summary: 'One-screen fast daily entry + drive form usage. Today reels/shifts/chemical/utility all 0 rows — report still hand-typed (validation gap 1).', items: ['Single fast daily-entry screen', 'Drive capture-form adoption per dept — gap #1'] },
      { id: 'ph17i', title: 'Ph17-I — Live Instrument Feed', status: 'Done', progress: 100, summary: 'QCS/weighbridge/energy-meter/steam-flow auto-capture, hourly snapshot, WebSocket push, 07:00 auto-publish (validation gap 12).', items: ['utility_hourly_snapshot table', 'QCS + weighbridge + meter integration — gap #12', 'WebSocket live dashboard push', '07:00 auto-publish + variance alerts'] },
    ]
  },
  {
    id: 'hrsec',
    title: 'HR Security Fixes (Ph18)',
    color: '#dc2626',
    phases: [
      { id: 'ph18a', title: 'Ph18-A — Cross-Dept Leave Guard', status: 'Done', progress: 100, summary: 'Validation gap #13: /leaves/:id/approve is L2+ with NO dept guard — any supervisor approves any department. Breaks HRMS rule #6.', items: ['Add dept isolation to /leaves/:id/approve', 'Allow cross-dept only if is_hr_admin or role_level >= 4', 'Same guard shape as /employees/:id fix'] },
      { id: 'ph18b', title: 'Ph18-B — F&F Clearance Gate', status: 'Done', progress: 100, summary: 'Validation gap #14: /separation/:id/complete settles F&F + deactivates at L3 with NO clearance_items check. Breaks HRMS rule #10.', items: ['Block completion if any clearance_items pending', 'Seed clearance items on separation init', 'Raise F&F approval to L4 (Plant Head)'] },
    ]
  },
  {
    id: 'deploy',
    title: 'Deploy Track',
    color: '#16a34a',
    phases: [
      { id: 'da', title: 'Deploy A — Run Right',  status: 'Done',    progress: 100, summary: 'DB migrate, sync green, untrack node_modules, node engines.',     items: ['db:migrate script', 'schema_migrations ledger', '.gitignore node_modules', 'engines: node>=18'] },
      { id: 'db', title: 'Deploy B — Security',   status: 'Done',    progress: 100, summary: 'JWT boot-check, login rate limiter, CORS lock to CORS_ORIGIN.',    items: ['JWT boot-check', 'Rate limit 10/15min', 'CORS locked', 'Dev dashboard guard'] },
      { id: 'dc', title: 'Deploy C — Prod Infra', status: 'Done',    progress: 100, summary: 'nginx+TLS, pm2-logrotate, pg_dump backup, preflight script.',      items: ['nginx config', 'pm2-logrotate', 'pg_dump cron', 'preflight.js'] },
      { id: 'dd', title: 'Deploy D — Go Live',    status: 'Planned', progress: 0,   summary: 'Deploy + smoke test per role + monitor. Blocked until VPS ready.', items: ['Clone + npm ci', 'Frontend build', 'Migrate + preflight', 'Smoke test all roles'] },
    ]
  },
  {
    id: 'deep_analysis',
    title: 'Deep Analysis (Ph19–22)',
    color: '#7c3aed',
    phases: [
      { id: 'ph19a', title: 'Ph19-A — Parameter Templates',         status: 'Done', progress: 100, summary: 'Defined parameter capture list per section (Wire, Press, Dryer, Boiler, ETP) in Documentation/27.', items: ['Wire vacuum levels','Press nip load','Dryer steam groups','Boiler efficiency','ETP COD/BOD'] },
      { id: 'ph19b', title: 'Ph19-B — Telemetry Ingest API',        status: 'Done', progress: 100, summary: 'POST /api/telemetry ingests into section_process_readings. Kafka: mkpm.telemetry.readings on every ingest.', items: ['POST /api/telemetry → Kafka mkpm.telemetry.readings','GET /api/telemetry/:equipId','GET /api/telemetry/section/:sectionId','6/6 smoke tests pass'] },
      { id: 'ph20a', title: 'Ph20-A/B — Quality Lab Tests',         status: 'Done', progress: 100, summary: 'quality_lab_tests table + POST/GET endpoints. Kafka: mkpm.quality.lab on every lab ingest.', items: ['quality_lab_tests table','POST /api/telemetry/lab → Kafka mkpm.quality.lab','GET /api/telemetry/lab/:reelId','freeness,CSF,burst,cobb,dirt,trim,slit captured'] },
      { id: 'ph20c', title: 'Ph20-C — Lab ↔ Vacuum Correlation',    status: 'Done', progress: 100, summary: 'GET /api/telemetry/correlate — joins quality_lab_tests + section_process_readings (VAC% tags) on ±15min window. Kafka: mkpm.analysis.correlation.', items: ['±15min time-window JOIN on VAC tags','Returns freeness + vacuum avg/min/max per test','Kafka mkpm.analysis.correlation broadcast','2 correlation rows verified in smoke test'] },
      { id: 'ph21a', title: 'Ph21-A/B/C/D — Machine Events',        status: 'Done', progress: 100, summary: 'machine_events table + CRUD endpoints. ALL events → mkpm.events.all; Critical events → also mkpm.events.critical.', items: ['machine_events table','POST /api/events → mkpm.events.all (all severity)','Critical also → mkpm.events.critical','PATCH /api/events/:id/resolve','GET /api/events + /api/events/section/:sectionId'] },
      { id: 'ph22a', title: 'Ph22 — Root Cause Brain',               status: 'Planned', progress: 0, summary: 'RCA linkage: event → nearest telemetry anomaly. Pareto of break causes. Predictive alerts.', items: ['Event → telemetry anomaly (±15min)','Pareto: top-5 break causes × section','Energy waste attribution','Predictive threshold alerts'] },
    ]
  },
  {
    id: 'dps_excel_import',
    title: 'Daily Performance Ingestion (Case 2)',
    color: '#0891b2',
    phases: [
      { id: 'ph23a', title: 'Ph23-A — Database Ingest Migration',    status: 'Done', progress: 100, summary: 'Add missing columns to daily_production_reports (ETP flows, feedwater, condensate, water).', items: ['etp_inlet_flow + etp_outlet_flow', 'etp_inlet_ppm + etp_outlet_ppm', 'fresh_water_mt + feed_water_mt', 'condensate_water_mt + pulper_running_minutes'] },
      { id: 'ph23b', title: 'Ph23-B — Backend Ingestion Engine',     status: 'Done', progress: 100, summary: 'Accept .xlsx files, convert durations, insert/upsert records, and publish to Kafka topic.', items: ['POST /api/production/dpr/import endpoint', 'Duration parser (HH:MM to minutes)', 'UPSERT on date + machine_id conflict', 'Kafka: mkpm.dpr.events broadcast'] },
      { id: 'ph23c', title: 'Ph23-C — Frontend Excel Upload Panel',  status: 'Done', progress: 100, summary: 'Create Excel Upload tab in Daily Report screen, show mapped preview + import status.', items: ['Drag-and-drop Excel selector', 'Data mapping validation screen', 'Success/error statistics panel'] },
      { id: 'ph23d', title: 'Ph23-D — Hybrid SCADA & IoT Transition', status: 'Planned', progress: 0, summary: 'Transition roadmap for direct machine PLC feeds via OPC UA/SCADA daemon integration.', items: ['Define Stage 2 Hybrid OPC UA collector', 'Automate key telemetry inputs', 'Configure MQTT/Kafka daemon bridge'] }
    ]
  },
  {
    id: 'production_enhancements',
    title: 'Production Enhancements (Ph24)',
    color: '#16a34a',
    phases: [
      { id: 'ph24a', title: 'Ph24-A — DB Enhancement Migration',    status: 'Done', progress: 100, summary: 'Add OEE design speed parameter to machines and chemical limit alerts tracking schema.', items: ['machines.design_speed_mpm', 'chemical_limit_alerts table'] },
      { id: 'ph24b', title: 'Ph24-B — OEE & Alarm Backend Engine',  status: 'Done', progress: 100, summary: 'Implement 3-Factor OEE calculation logic and specific chemical limit alarms on save.', items: ['A * P * Q availability/speed/yield math', 'chemical_limit_alerts DB insert', 'Breach Kafka trigger'] },
      { id: 'ph24c', title: 'Ph24-C — Printable QR Slip & Modal',   status: 'Done', progress: 100, summary: 'Design print stylesheet template modal and print actions for reel records.', items: ['Print slip modal UI', '@media print CSS rules', 'Serial QR code format'] }
    ]
  },
  {
    id: 'scada_boiler_energy',
    title: 'SCADA, Boiler & Energy (Ph25)',
    color: '#e11d48',
    phases: [
      { id: 'ph25a', title: 'Ph25-A — DB Telemetry Expansion',      status: 'Done', progress: 100, summary: 'Create tables for boiler hourly logs, thermal efficiency computations, and section energy allocations.', items: ['boiler_performance_logs table', 'section_energy_allocations table'] },
      { id: 'ph25b', title: 'Ph25-B — API & SCADA Daemon',          status: 'Done', progress: 100, summary: 'Build Express routes for boiler logs and energy allocations. Implement the background SCADA simulator daemon.', items: ['POST /api/telemetry/boiler (efficiency math)', 'POST /api/telemetry/energy', 'scripts/scada_collector_daemon.js'] },
      { id: 'ph25c', title: 'Ph25-C — Boiler & Energy UI',          status: 'Done', progress: 100, summary: 'Mount Boiler performance logs UI table and energy sub-metering breakdown chart screen.', items: ['Utility -> Boiler Logs tab', 'Dashboard -> Energy allocations bar charts', 'SCADA Daemon health badge in sidebar'] }
    ]
  },
  {
    id: 'rbac_plant_sections',
    title: 'Department Permissions & RBAC (Ph26)',
    color: '#8b5cf6',
    phases: [
      { id: 'ph26a', title: 'Ph26-A — API Guard & RBAC Logic',       status: 'Done', progress: 100, summary: 'Define plant sections permission matrix helper and enforce department write checks on backend endpoints.', items: ['hasSectionWriteAccess helper', 'POST readings/alarms/equipment guarded'] },
      { id: 'ph26b', title: 'Ph26-b — PlantSection UI Adaptation',    status: 'Done', progress: 100, summary: 'Import useAuth in PlantSection.jsx. Conditionally render equipment, readings, and alarms forms.', items: ['AuthContext integration', 'Form cards conditional rendering', 'Acknowledge/Resolve buttons guarded'] },
      { id: 'ph26c', title: 'Ph26-c — Dept Isolation & Data Integrity Pass', status: 'Done', progress: 100, summary: 'Backfilled section/machine linkage and fixed cross-department data leaks: machine-to-section map, chemical consumption machine_id + ownership check, GRN vendor/transaction_type bugs, opening-stock ledger backfill for ~806 materials.', items: ['migration_section_equipment_machine_map.sql', 'migration_chemical_consumption_machine_id.sql', 'migration_backfill_opening_stock_ledger.sql', 'hr.js/production.js/quality.js/maintenance.js dept-isolation guards (role_level>=4 sees all)', 'inventory.js GRN vendor_id + transaction_type case-mismatch fix'] }
    ]
  }
]

export function getPhaseSummary() {
  const all = PHASE_GROUPS.flatMap(g => g.phases)
  const doneCount = all.filter(p => p.status === 'Done').length
  const inWorkCount = all.filter(p => p.status === 'In Work' || p.status === 'Partial').length
  return { groups: PHASE_GROUPS, phases: all, doneCount, inWorkCount, total: all.length }
}

// kept for backward compat
export function getPhaseStatuses() { return getPhaseSummary().phases }
