const router  = require('express').Router();
const pool    = require('../db/pool');
const { auth, requireLevel } = require('../middleware/auth');
const ar      = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Mask sensitive field, keep last 4 (doc 23 §16). null/short -> as-is.
const maskTail = v => {
  if (v == null) return v;
  const s = String(v);
  return s.length <= 4 ? s : '*'.repeat(s.length - 4) + s.slice(-4);
};

const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const PDFDocument = require('pdfkit');

// ─── FILE UPLOAD (multer) ────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../uploads/hr');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = /pdf|doc|docx|jpg|jpeg|png|xlsx|csv/.test(file.originalname.toLowerCase());
    cb(ok ? null : new Error('File type not allowed'), ok);
  },
});

// POST /upload — single file, returns { url }
router.post('/upload', auth, requireLevel(2), upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ success: false, message: 'No file received' });
  const url = `/uploads/hr/${req.file.filename}`;
  res.json({ success: true, url, originalName: req.file.originalname, sizeKb: Math.round(req.file.size / 1024) });
});

// EMPLOYEES LIST
router.get('/employees', auth, ar(async (req, res) => {
  const { dept, search, is_active='true', page=1, limit=30 } = req.query;
  const lvl       = req.user.role_level || 0;
  const canSeeAll = req.user.is_hr_admin || lvl >= 4;
  const conds=[]; const params=[]; let p=1;
  if (is_active!=='') { conds.push(`e.is_active=$${p++}`); params.push(is_active==='true'); }
  if (!canSeeAll) { conds.push(`e.department_id=$${p++}`); params.push(req.user.department_id); }
  else if (dept)  { conds.push(`e.department_id=$${p++}`); params.push(dept); }
  if (search) { conds.push(`(e.name ILIKE $${p} OR e.employee_code ILIKE $${p})`); params.push(`%${search}%`); p++; }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT e.id, e.employee_code as "employeeCode", e.name, e.designation,
            e.mobile, e.email, e.doj, e.gender, e.basic_salary as "basicSalary",
            e.is_active as "isActive", d.name as "deptName"
     FROM employees e LEFT JOIN departments d ON d.id=e.department_id
     ${where} ORDER BY e.name ASC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(`SELECT COUNT(*) FROM employees e ${where}`, params);
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// GET ONE
// GET /employees/me — own employee record linked to logged-in user (by user_id, fallback by employee_code)
router.get('/employees/me', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.*, d.name AS "deptName", d.id AS "deptId"
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.is_active = true
       AND (
         e.user_id = $1
         OR (e.user_id IS NULL AND e.employee_code IS NOT NULL
             AND e.employee_code = (SELECT employee_code FROM users WHERE id = $1 AND employee_code IS NOT NULL LIMIT 1))
       )
     ORDER BY (e.user_id = $1) DESC
     LIMIT 1`,
    [req.user.id]
  );
  res.json({ success: true, data: rows[0] || null });
}));

router.get('/employees/:id', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.*, d.name as "deptName" FROM employees e
     LEFT JOIN departments d ON d.id=e.department_id WHERE e.id=$1`, [req.params.id]
  );
  if (!rows.length) return res.json({ success: false, message: 'Not found' });
  const emp = rows[0];

  // Access tiers (doc 23 §5.1 + §13 rule #5): L1 own only · L2/L3 own dept · L4+/HR all
  const lvl       = req.user.role_level || 0;
  const canSeeAll = req.user.is_hr_admin || lvl >= 4;
  const own       = req.user.emp_id && String(req.user.emp_id) === String(emp.id);
  const sameDept  = emp.department_id && emp.department_id === req.user.department_id;
  if (!canSeeAll) {
    if (lvl <= 1 && !own)              return res.status(403).json({ success: false, message: 'Access denied' });
    if (lvl <= 3 && !own && !sameDept) return res.status(403).json({ success: false, message: 'Access denied — outside your department' });
  }

  // Mask PII for anyone below L4 / non-HR (even own record — §16). Never leak others' salary.
  if (!canSeeAll) {
    emp.aadhar       = maskTail(emp.aadhar);
    emp.pan          = maskTail(emp.pan);
    emp.bank_account = maskTail(emp.bank_account);
    if (!own) emp.basic_salary = null;
  }
  res.json({ success: true, data: emp });
}));

// CREATE EMPLOYEE
router.post('/employees', auth, requireLevel(3), ar(async (req, res) => {
  const {
    employee_code, name, department_id, designation, doj, dob, gender,
    mobile, email, aadhar, pan, pf_number, esic_number,
    bank_account, bank_name, ifsc, basic_salary, user_id
  } = req.body;
  if (!name) return res.json({ success:false, message:'Name required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO employees
         (employee_code,name,user_id,department_id,designation,doj,dob,gender,
          mobile,email,aadhar,pan,pf_number,esic_number,
          bank_account,bank_name,ifsc,basic_salary,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true) RETURNING *`,
      [employee_code||null,name,user_id||null,department_id||null,designation||null,doj||null,dob||null,gender||null,
       mobile||null,email||null,aadhar||null,pan||null,pf_number||null,esic_number||null,
       bank_account||null,bank_name||null,ifsc||null,basic_salary||null]
    );
    const emp = rows[0];
    // auto-init onboarding checklist (Ph16-K) — SAVEPOINT so a missing table never aborts the main txn
    try {
      await client.query('SAVEPOINT sp_onboarding');
      const { rows: tasks } = await client.query(
        `SELECT id, due_days FROM onboarding_tasks_master WHERE is_active=true`
      );
      if (tasks.length) {
        const joinDate = doj ? new Date(doj) : new Date();
        for (const t of tasks) {
          const due = new Date(joinDate);
          due.setDate(due.getDate() + (t.due_days || 0));
          await client.query(
            `INSERT INTO onboarding_checklist (employee_id, task_id, due_date)
             VALUES ($1,$2,$3) ON CONFLICT (employee_id,task_id) DO NOTHING`,
            [emp.id, t.id, due.toISOString().slice(0,10)]
          );
        }
      }
    } catch (_) {
      await client.query('ROLLBACK TO SAVEPOINT sp_onboarding');
    }
    await client.query('COMMIT');
    res.json({ success:true, data:emp });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// UPDATE
router.put('/employees/:id', auth, requireLevel(3), ar(async (req, res) => {
  const {
    name,department_id,designation,doj,dob,gender,mobile,email,
    aadhar,pan,pf_number,esic_number,bank_account,bank_name,ifsc,basic_salary,is_active,user_id
  } = req.body;
  const { rows } = await pool.query(
    `UPDATE employees SET name=$1,department_id=$2,designation=$3,doj=$4,dob=$5,gender=$6,
       mobile=$7,email=$8,aadhar=$9,pan=$10,pf_number=$11,esic_number=$12,
       bank_account=$13,bank_name=$14,ifsc=$15,basic_salary=$16,is_active=$17,user_id=$18
     WHERE id=$19 RETURNING *`,
    [name,department_id||null,designation||null,doj||null,dob||null,gender||null,
     mobile||null,email||null,aadhar||null,pan||null,pf_number||null,esic_number||null,
     bank_account||null,bank_name||null,ifsc||null,basic_salary||null,
     is_active!==undefined?is_active:true, user_id||null, req.params.id]
  );
  res.json({ success:!!rows.length, data:rows[0] });
}));

// ATTENDANCE LIST
router.get('/attendance', auth, ar(async (req, res) => {
  const { date, employee_id, page=1, limit=50 } = req.query;
  const d = date || new Date().toISOString().slice(0,10);
  const conds=[`a.date=$1`]; const params=[d]; let p=2;
  if (employee_id) { conds.push(`a.employee_id=$${p++}`); params.push(employee_id); }
  const offset=(parseInt(page)-1)*parseInt(limit);
  const { rows } = await pool.query(
    `SELECT a.id, a.date, a.shift_type as "shiftType", a.status,
            a.in_time as "inTime", a.out_time as "outTime", a.hours_worked as "hoursWorked",
            a.remarks, e.name as "employeeName", e.employee_code as "employeeCode",
            d.name as "deptName"
     FROM attendance a
     JOIN employees e ON e.id=a.employee_id
     LEFT JOIN departments d ON d.id=e.department_id
     WHERE ${conds.join(' AND ')} ORDER BY e.name ASC LIMIT $${p} OFFSET $${p+1}`,
    [...params, parseInt(limit), offset]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*) FROM attendance a WHERE ${conds.join(' AND ')}`, params
  );
  res.json({ success:true, data:rows, total:parseInt(cnt[0].count) });
}));

// MARK ATTENDANCE (upsert — unique employee+date)
router.post('/attendance', auth, requireLevel(2), ar(async (req, res) => {
  const { employee_id, date, shift_type, status='Present', in_time, out_time, remarks } = req.body;
  if (!employee_id || !date) return res.json({ success:false, message:'Employee + date required' });
  let hours = null;
  if (in_time && out_time) hours = (new Date(out_time)-new Date(in_time))/3600000;
  const { rows } = await pool.query(
    `INSERT INTO attendance (employee_id,date,shift_type,status,in_time,out_time,hours_worked,remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (employee_id,date) DO UPDATE SET
       shift_type=$3,status=$4,in_time=$5,out_time=$6,hours_worked=$7,remarks=$8
     RETURNING *`,
    [employee_id,date,shift_type||null,status,in_time||null,out_time||null,hours,remarks||null]
  );
  res.json({ success:true, data:rows[0] });
}));

// BULK ATTENDANCE (mark all present for a date)
router.post('/attendance/bulk', auth, requireLevel(2), ar(async (req, res) => {
  const { date, shift_type, records=[] } = req.body;
  if (!date || !records.length) return res.json({ success:false, message:'Date + records required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of records) {
      await client.query(
        `INSERT INTO attendance (employee_id,date,shift_type,status)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (employee_id,date) DO UPDATE SET shift_type=$3,status=$4`,
        [r.employee_id, date, shift_type||null, r.status||'Present']
      );
    }
    await client.query('COMMIT');
    res.json({ success:true, count:records.length });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// ATTENDANCE SUMMARY
router.get('/attendance/summary', auth, ar(async (req, res) => {
  const { date } = req.query;
  const d = date || new Date().toISOString().slice(0,10);
  const { rows } = await pool.query(
    `SELECT status, COUNT(*) as count FROM attendance WHERE date=$1 GROUP BY status`, [d]
  );
  const { rows: total } = await pool.query(`SELECT COUNT(*) FROM employees WHERE is_active=true`);
  res.json({ success:true, data:{ date:d, byStatus:rows, totalActive:parseInt(total[0].count) }});
}));

// GET /payroll — list all processed payroll records for a month
router.get('/payroll', auth, requireLevel(2), ar(async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ success: false, message: 'Month (YYYY-MM) is required' });
  const lvl       = req.user.role_level || 0;
  const canSeeAll = req.user.is_hr_admin || lvl >= 4;
  const params = [month];
  let deptFilter = '';
  if (!canSeeAll) { deptFilter = `AND e.department_id = $2`; params.push(req.user.department_id); }
  const { rows } = await pool.query(
    `SELECT p.id, p.month, p.present_days as "presentDays", p.basic_salary as "basicSalary",
            p.allowances, p.deductions, p.net_salary as "netSalary", p.status, p.paid_date as "paidDate",
            e.name as "employeeName", e.employee_code as "employeeCode", d.name as "deptName"
     FROM payrolls p
     JOIN employees e ON p.employee_id = e.id
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE p.month = $1 ${deptFilter}
     ORDER BY e.name ASC`,
    params
  );
  res.json({ success: true, data: rows });
}));

// POST /payroll/generate — generate payroll records for a specific month based on attendance
router.post('/payroll/generate', auth, requireLevel(3), ar(async (req, res) => {
  const { month } = req.body;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ success: false, message: 'Valid month (YYYY-MM) is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch all active employees
    const { rows: emps } = await client.query(
      `SELECT id, basic_salary FROM employees WHERE is_active = true`
    );

    // Get date range for target month
    const year = parseInt(month.split('-')[0]);
    const monthNum = parseInt(month.split('-')[1]);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${daysInMonth}`;

    const generated = [];

    for (const emp of emps) {
      const basic = parseFloat(emp.basic_salary || 0);
      
      // Calculate active working days where employee was 'Present' or 'Late'
      const { rows: attRows } = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM attendance
         WHERE employee_id = $1 AND date BETWEEN $2 AND $3 AND status IN ('Present', 'Late')`,
        [emp.id, startDate, endDate]
      );
      const presentDays = attRows[0]?.count || 0;

      // Net salary = base salary prorated by attendance + 10% standard allowances - 5% tax deduction
      // If no attendance recorded at all, proration assumes full payout if no absent record exists, but here we enforce strict attendance matching:
      // Let's assume standard 26-day working month proration factor.
      const workingDaysLimit = 26;
      const ratio = presentDays > 0 ? Math.min(1, presentDays / workingDaysLimit) : 0;
      const proratedBasic = basic * ratio;
      const allowance = proratedBasic * 0.10;
      const deduction = proratedBasic * 0.05;
      const netSalary = Math.round((proratedBasic + allowance - deduction) * 100) / 100;

      const { rows: payRows } = await client.query(
        `INSERT INTO payrolls (employee_id, month, present_days, basic_salary, allowances, deductions, net_salary, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', $8)
         ON CONFLICT (employee_id, month) DO UPDATE SET
           present_days = EXCLUDED.present_days,
           basic_salary = EXCLUDED.basic_salary,
           allowances = EXCLUDED.allowances,
           deductions = EXCLUDED.deductions,
           net_salary = EXCLUDED.net_salary,
           status = 'Draft'
         RETURNING *`,
        [emp.id, month, presentDays, basic, allowance, deduction, netSalary, req.user.id]
      );
      generated.push(payRows[0]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Payroll generated for ${generated.length} employees`, count: generated.length });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// PUT /payroll/:id/pay — mark a payroll record as Paid
// Legacy single-step pay (no separate approve stage like payroll_runs V2) — bumped to level4 since
// this path has no maker-checker at all, one person both decides and releases payment here.
router.put('/payroll/:id/pay', auth, requireLevel(4), ar(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    `UPDATE payrolls
     SET status = 'Paid', paid_date = CURRENT_DATE
     WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ success: false, message: 'Payroll record not found' });
  res.json({ success: true, data: rows[0] });
}));

// ─── SELF-SERVICE ROUTES (all authenticated users — own data only) ──────────

// GET /attendance/me — own attendance (filter by month=YYYY-MM or last 60 days)
router.get('/attendance/me', auth, ar(async (req, res) => {
  const emp = await pool.query(
    `SELECT id FROM employees WHERE user_id = $1 AND is_active = true LIMIT 1`,
    [req.user.id]
  );
  if (!emp.rows.length) return res.json({ success: true, data: [], summary: null });

  const empId = emp.rows[0].id;
  const { month } = req.query; // YYYY-MM optional

  let dateFilter = '';
  const params = [empId];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    dateFilter = `AND TO_CHAR(a.date,'YYYY-MM') = $2`;
    params.push(month);
  } else {
    dateFilter = `AND a.date >= CURRENT_DATE - INTERVAL '60 days'`;
  }

  const { rows } = await pool.query(
    `SELECT a.id, a.date, a.shift_type AS "shiftType", a.status,
            a.in_time AS "inTime", a.out_time AS "outTime",
            a.hours_worked AS "hoursWorked", a.remarks
     FROM attendance a
     WHERE a.employee_id = $1 ${dateFilter}
     ORDER BY a.date DESC`,
    params
  );

  // summary counts
  const summary = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    acc.total++;
    return acc;
  }, { total: 0 });

  res.json({ success: true, data: rows, summary });
}));

// GET /payroll/me — own payslip history (Ph16 payroll_details first, fallback to legacy payrolls)
router.get('/payroll/me', auth, ar(async (req, res) => {
  const emp = await pool.query(
    `SELECT id, basic_salary, name, employee_code, pf_number, esic_number,
            bank_account, bank_name
     FROM employees WHERE user_id = $1 AND is_active = true LIMIT 1`,
    [req.user.id]
  );
  if (!emp.rows.length) return res.json({ success: true, data: [], employee: null });

  const empId = emp.rows[0].id;

  // Try Ph16 payroll_details first
  let slips = [];
  let usedPh16 = false;
  try {
    const { rows: ph16rows } = await pool.query(
      `SELECT pd.id,
              TO_CHAR(pr.month,'YYYY-MM') AS month,
              pd.present_days AS "presentDays",
              pd.basic        AS "basicSalary",
              (pd.hra + pd.da + pd.conveyance + pd.medical + pd.special_allowance) AS allowances,
              pd.total_deductions AS deductions,
              pd.net_salary   AS "netSalary",
              pd.payment_status AS status,
              pd.payment_date AS "paidDate",
              pd.gross_salary AS "grossSalary",
              pd.pf_employee  AS "pfEmployee",
              pd.professional_tax AS pt,
              pd.tds          AS "tdsAmount"
       FROM payroll_details pd
       JOIN payroll_runs pr ON pr.id = pd.payroll_run_id
       WHERE pd.employee_id = $1
       ORDER BY pr.month DESC LIMIT 24`,
      [empId]
    );
    if (ph16rows.length) { slips = ph16rows; usedPh16 = true; }
  } catch (_) { /* Ph16 not migrated yet */ }

  // Fallback to legacy payrolls table
  if (!usedPh16) {
    const { rows } = await pool.query(
      `SELECT p.id, p.month, p.present_days AS "presentDays",
              p.basic_salary AS "basicSalary", p.allowances, p.deductions,
              p.net_salary AS "netSalary", p.status, p.paid_date AS "paidDate"
       FROM payrolls p
       WHERE p.employee_id = $1
       ORDER BY p.month DESC LIMIT 24`,
      [empId]
    );
    slips = rows.map(r => {
      const basic = parseFloat(r.basicSalary || 0);
      const gross = basic + parseFloat(r.allowances || 0);
      const pfEmp = Math.round(Math.min(basic, 15000) * 0.12);
      const pt    = gross > 10000 ? 175 : 0;
      const tds   = Math.max(0, parseFloat(r.deductions || 0) - pfEmp - pt);
      return { ...r, grossSalary: gross, pfEmployee: pfEmp, pt, tdsAmount: Math.round(tds) };
    });
  }

  // YTD: sum slips in current financial year (Apr–Mar)
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  let ytdGross = 0, ytdTds = 0, ytdPf = 0;
  slips.forEach(s => {
    const [yr, mo] = (s.month || '').split('-').map(Number);
    const inFY = (mo >= 4 && yr === fyStart) || (mo < 4 && yr === fyStart + 1);
    if (inFY) { ytdGross += parseFloat(s.grossSalary||0); ytdTds += parseFloat(s.tdsAmount||0); ytdPf += parseFloat(s.pfEmployee||0); }
  });

  res.json({
    success: true,
    data: slips,
    employee: emp.rows[0],
    ytd: { gross: Math.round(ytdGross), tds: Math.round(ytdTds), pf: Math.round(ytdPf) },
    source: usedPh16 ? 'ph16' : 'legacy'
  });
}));

// GET /leaves/me — own leave stats derived from attendance (pre-Ph16 table)
router.get('/leaves/me', auth, ar(async (req, res) => {
  const emp = await pool.query(
    `SELECT id FROM employees WHERE user_id = $1 AND is_active = true LIMIT 1`,
    [req.user.id]
  );
  if (!emp.rows.length) return res.json({ success: true, data: null });

  const empId = emp.rows[0].id;
  const year = new Date().getFullYear();

  const { rows } = await pool.query(
    `SELECT status, COUNT(*) AS count
     FROM attendance
     WHERE employee_id = $1
       AND EXTRACT(YEAR FROM date) = $2
       AND status IN ('Leave','Half Day','OT','Present','Absent','Holiday')
     GROUP BY status`,
    [empId, year]
  );

  const counts = rows.reduce((a, r) => { a[r.status] = parseInt(r.count); return a; }, {});

  // Check if Ph16 leave_balance table exists — gracefully fallback
  let balances = [];
  try {
    const lb = await pool.query(
      `SELECT lb.*, lt.code, lt.name AS "leaveTypeName", lt.annual_quota AS "quota"
       FROM employee_leave_balances lb
       JOIN employee_leave_types lt ON lt.id = lb.leave_type_id
       WHERE lb.employee_id = $1 AND lb.year = $2
       ORDER BY lt.code`,
      [empId, year]
    );
    balances = lb.rows;
  } catch (_) {
    // Ph16 tables not yet migrated — use attendance-derived proxy
    balances = [];
  }

  res.json({
    success: true,
    data: {
      year,
      attendanceCounts: counts,
      balances,        // empty pre-Ph16, real post-Ph16
      ph16Ready: balances.length > 0,
    }
  });
}));

// GET /leave-types — for frontend dropdowns (all authenticated users)
router.get('/leave-types', auth, ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, code, name, annual_quota AS "annualQuota", paid, carry_forward AS "carryForward", description
     FROM employee_leave_types WHERE is_active=true ORDER BY code`
  );
  res.json({ success: true, data: rows });
}));

// ─── Ph16-D: LEAVE APPLICATION WORKFLOW ─────────────────────────────────────

// helper — resolve employee_id from user_id
async function getEmpId(userId) {
  const { rows } = await pool.query(
    `SELECT id, department_id FROM employees WHERE user_id = $1 AND is_active = true LIMIT 1`, [userId]
  );
  return rows[0] || null;
}

// POST /leaves/apply — employee submits leave request
router.post('/leaves/apply', auth, ar(async (req, res) => {
  const emp = await getEmpId(req.user.id);
  if (!emp) return res.json({ success: false, message: 'No employee record linked to your account' });

  const { leave_type_id, from_date, to_date, days, half_day = false, reason } = req.body;
  if (!leave_type_id || !from_date || !to_date || !days)
    return res.json({ success: false, message: 'leave_type_id, from_date, to_date, days required' });

  const year = new Date(from_date).getFullYear();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check balance (skip LOP — no balance check)
    const lt = await client.query(`SELECT code, annual_quota FROM employee_leave_types WHERE id=$1`, [leave_type_id]);
    const leaveType = lt.rows[0];
    let balanceBefore = null;

    if (leaveType && leaveType.code !== 'LOP' && leaveType.annual_quota != null) {
      const bal = await client.query(
        `SELECT closing_balance FROM employee_leave_balances
         WHERE employee_id=$1 AND leave_type_id=$2 AND year=$3`,
        [emp.id, leave_type_id, year]
      );
      if (bal.rows.length) {
        balanceBefore = parseFloat(bal.rows[0].closing_balance);
        if (balanceBefore < parseFloat(days))
          return await client.query('ROLLBACK').then(() =>
            res.json({ success: false, message: `Insufficient balance. Available: ${balanceBefore} days` })
          );
      }
    }

    const { rows } = await client.query(
      `INSERT INTO leave_applications
         (employee_id, leave_type_id, from_date, to_date, days, half_day, reason, balance_before)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [emp.id, leave_type_id, from_date, to_date, parseFloat(days), half_day, reason || null, balanceBefore]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// GET /leaves/team — supervisor/HR sees pending applications for their dept (or all for HR Admin)
router.get('/leaves/team', auth, requireLevel(2), ar(async (req, res) => {
  const { status = 'Pending', dept_id } = req.query;
  const lvl  = req.user.role_level;
  const isHRAdmin = (req.user.dept_code === 'HR' || req.user.department === 'HR & Payroll') && lvl >= 3;
  const canSeeAll = isHRAdmin || lvl >= 4;

  let empDept = null;
  if (!canSeeAll) {
    const emp = await getEmpId(req.user.id);
    if (!emp) return res.json({ success: true, data: [] });
    empDept = emp.department_id;
  }

  const conds = []; const params = []; let p = 1;
  if (status) { conds.push(`la.status=$${p++}`); params.push(status); }
  if (!canSeeAll && empDept) { conds.push(`e.department_id=$${p++}`); params.push(empDept); }
  if (canSeeAll && dept_id) { conds.push(`e.department_id=$${p++}`); params.push(dept_id); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT la.id, la.from_date AS "fromDate", la.to_date AS "toDate", la.days,
            la.half_day AS "halfDay", la.reason, la.status, la.applied_on AS "appliedOn",
            la.rejection_reason AS "rejectionReason",
            e.name AS "employeeName", e.employee_code AS "employeeCode",
            d.name AS "deptName",
            lt.code AS "leaveCode", lt.name AS "leaveTypeName"
     FROM leave_applications la
     JOIN employees e ON e.id = la.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     JOIN employee_leave_types lt ON lt.id = la.leave_type_id
     ${where}
     ORDER BY la.applied_on DESC LIMIT 200`,
    params
  );
  res.json({ success: true, data: rows });
}));

// GET /leaves/my-applications — own leave history
router.get('/leaves/my-applications', auth, ar(async (req, res) => {
  const emp = await getEmpId(req.user.id);
  if (!emp) return res.json({ success: true, data: [] });
  const { rows } = await pool.query(
    `SELECT la.id, la.from_date AS "fromDate", la.to_date AS "toDate", la.days,
            la.half_day AS "halfDay", la.reason, la.status, la.applied_on AS "appliedOn",
            la.rejection_reason AS "rejectionReason", la.balance_before AS "balanceBefore",
            lt.code AS "leaveCode", lt.name AS "leaveTypeName"
     FROM leave_applications la
     JOIN employee_leave_types lt ON lt.id = la.leave_type_id
     WHERE la.employee_id = $1
     ORDER BY la.applied_on DESC LIMIT 50`,
    [emp.id]
  );
  res.json({ success: true, data: rows });
}));

// PUT /leaves/:id/approve — L2+ approves; deducts balance + marks attendance
router.put('/leaves/:id/approve', auth, requireLevel(2), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: appRows } = await client.query(
      `SELECT la.*, lt.code AS leave_code, lt.annual_quota, e.department_id
       FROM leave_applications la
       JOIN employee_leave_types lt ON lt.id = la.leave_type_id
       JOIN employees e ON e.id = la.employee_id
       WHERE la.id = $1 AND la.status = 'Pending'`,
      [req.params.id]
    );
    if (!appRows.length) {
      await client.query('ROLLBACK');
      return res.json({ success: false, message: 'Application not found or already actioned' });
    }
    const app = appRows[0];

    // Dept isolation guard (Ph18-A / Gap #13)
    const lvl       = req.user.role_level || 0;
    const canSeeAll = req.user.is_hr_admin || lvl >= 4;
    const sameDept  = app.department_id && app.department_id === req.user.department_id;
    if (!canSeeAll && !sameDept) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Access denied — outside your department' });
    }

    // update application
    await client.query(
      `UPDATE leave_applications
       SET status='Approved', approved_by=$1, approved_on=now(), balance_after=$2
       WHERE id=$3`,
      [req.user.id, app.balance_before != null ? app.balance_before - parseFloat(app.days) : null, app.id]
    );

    // deduct balance if tracked
    if (app.leave_code !== 'LOP' && app.annual_quota != null) {
      const year = new Date(app.from_date).getFullYear();
      await client.query(
        `INSERT INTO employee_leave_balances (employee_id, leave_type_id, year, opening_balance, credited, availed)
         VALUES ($1,$2,$3,0,$4,$5)
         ON CONFLICT (employee_id,leave_type_id,year) DO UPDATE
           SET availed = employee_leave_balances.availed + $5, updated_at = now()`,
        [app.employee_id, app.leave_type_id, year, app.annual_quota, parseFloat(app.days)]
      );
    }

    // mark attendance as Leave for each date in range
    const from = new Date(app.from_date);
    const to   = new Date(app.to_date);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      await client.query(
        `INSERT INTO attendance (employee_id, date, status, remarks)
         VALUES ($1,$2,'Leave',$3)
         ON CONFLICT (employee_id,date) DO UPDATE SET status='Leave', remarks=$3`,
        [app.employee_id, ds, `Leave approved by ${req.user.name || 'Supervisor'}`]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Leave approved' });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// PUT /leaves/:id/reject — L2+ rejects with reason
router.put('/leaves/:id/reject', auth, requireLevel(2), ar(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.json({ success: false, message: 'Rejection reason required' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: appRows } = await client.query(
      `SELECT la.*, e.department_id
       FROM leave_applications la
       JOIN employees e ON e.id = la.employee_id
       WHERE la.id = $1 AND la.status = 'Pending'`,
      [req.params.id]
    );
    if (!appRows.length) {
      await client.query('ROLLBACK');
      return res.json({ success: false, message: 'Application not found or already actioned' });
    }
    const app = appRows[0];

    // Dept isolation guard (Ph18-A / Gap #13)
    const lvl       = req.user.role_level || 0;
    const canSeeAll = req.user.is_hr_admin || lvl >= 4;
    const sameDept  = app.department_id && app.department_id === req.user.department_id;
    if (!canSeeAll && !sameDept) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Access denied — outside your department' });
    }

    await client.query(
      `UPDATE leave_applications
       SET status='Rejected', approved_by=$1, approved_on=now(), rejection_reason=$2
       WHERE id=$3`,
      [req.user.id, reason, app.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Rejected' });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// PUT /leaves/:id/cancel — employee cancels own pending leave
router.put('/leaves/:id/cancel', auth, ar(async (req, res) => {
  const emp = await getEmpId(req.user.id);
  if (!emp) return res.json({ success: false, message: 'No employee record' });
  const { rows } = await pool.query(
    `UPDATE leave_applications
     SET status='Cancelled'
     WHERE id=$1 AND employee_id=$2 AND status='Pending' RETURNING id`,
    [req.params.id, emp.id]
  );
  res.json({ success: !!rows.length, message: rows.length ? 'Cancelled' : 'Not found or already actioned' });
}));

// ─── Ph16-E: SALARY STRUCTURES ───────────────────────────────────────────────

// GET /salary-structures — list all
router.get('/salary-structures', auth, requireLevel(3), ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM salary_structures WHERE is_active=true ORDER BY grade, code`
  );
  res.json({ success: true, data: rows });
}));

// POST /salary-structures — HR Admin creates
router.post('/salary-structures', auth, requireLevel(3), ar(async (req, res) => {
  const { code, name, grade, basic_pct=100, hra_pct=40, da_pct=20, conv_fixed=1600, medical_fixed=1250, special_pct=0 } = req.body;
  if (!code || !name) return res.json({ success: false, message: 'code and name required' });
  const { rows } = await pool.query(
    `INSERT INTO salary_structures (code,name,grade,basic_pct,hra_pct,da_pct,conv_fixed,medical_fixed,special_pct)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [code, name, grade||null, basic_pct, hra_pct, da_pct, conv_fixed, medical_fixed, special_pct]
  );
  res.json({ success: true, data: rows[0] });
}));

// PUT /salary-structures/:id — update
router.put('/salary-structures/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { name, grade, basic_pct, hra_pct, da_pct, conv_fixed, medical_fixed, special_pct, is_active } = req.body;
  const { rows } = await pool.query(
    `UPDATE salary_structures
     SET name=COALESCE($1,name), grade=COALESCE($2,grade),
         basic_pct=COALESCE($3,basic_pct), hra_pct=COALESCE($4,hra_pct),
         da_pct=COALESCE($5,da_pct), conv_fixed=COALESCE($6,conv_fixed),
         medical_fixed=COALESCE($7,medical_fixed), special_pct=COALESCE($8,special_pct),
         is_active=COALESCE($9,is_active)
     WHERE id=$10 RETURNING *`,
    [name, grade, basic_pct, hra_pct, da_pct, conv_fixed, medical_fixed, special_pct, is_active, req.params.id]
  );
  res.json({ success: !!rows.length, data: rows[0] });
}));

// GET /salary-structures/employee/:emp_id — get current assignment
router.get('/salary-structures/employee/:emp_id', auth, requireLevel(2), ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT esa.*, ss.code, ss.name AS "structureName", ss.grade,
            ss.basic_pct AS "basicPct", ss.hra_pct AS "hraPct",
            ss.da_pct AS "daPct", ss.conv_fixed AS "convFixed",
            ss.medical_fixed AS "medicalFixed", ss.special_pct AS "specialPct"
     FROM employee_salary_assignments esa
     JOIN salary_structures ss ON ss.id = esa.salary_structure_id
     WHERE esa.employee_id = $1
       AND esa.effective_from <= CURRENT_DATE
       AND (esa.effective_to IS NULL OR esa.effective_to >= CURRENT_DATE)
     ORDER BY esa.effective_from DESC LIMIT 1`,
    [req.params.emp_id]
  );
  res.json({ success: true, data: rows[0] || null });
}));

// POST /salary-structures/assign — assign structure to employee
router.post('/salary-structures/assign', auth, requireLevel(3), ar(async (req, res) => {
  const { employee_id, salary_structure_id, effective_from } = req.body;
  if (!employee_id || !salary_structure_id || !effective_from)
    return res.json({ success: false, message: 'employee_id, salary_structure_id, effective_from required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // close previous open assignment
    await client.query(
      `UPDATE employee_salary_assignments
       SET effective_to = $1::date - 1
       WHERE employee_id = $2 AND effective_to IS NULL`,
      [effective_from, employee_id]
    );
    const { rows } = await client.query(
      `INSERT INTO employee_salary_assignments (employee_id, salary_structure_id, effective_from, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [employee_id, salary_structure_id, effective_from, req.user.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// ─── Ph16-I: TRAINING MODULE ─────────────────────────────────────────────────

// GET /training — list programs (filtered by dept if L1/L2)
router.get('/training', auth, ar(async (req, res) => {
  const { status, year } = req.query;
  const conds = []; const params = []; let p = 1;
  if (status) { conds.push(`tp.status=$${p++}`); params.push(status); }
  if (year)   { conds.push(`EXTRACT(YEAR FROM tp.scheduled_date)=$${p++}`); params.push(year); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT tp.*, u.name AS "createdBy",
            COUNT(ta.id) AS "nomineeCount"
     FROM training_programs tp
     LEFT JOIN users u ON u.id=tp.created_by
     LEFT JOIN training_attendance ta ON ta.training_id=tp.id
     ${where}
     GROUP BY tp.id, u.name
     ORDER BY tp.scheduled_date DESC LIMIT 100`,
    params
  );
  res.json({ success: true, data: rows });
}));

// POST /training — HR Admin creates program
router.post('/training', auth, requireLevel(3), ar(async (req, res) => {
  const { title, category, trainer_name, trainer_type='Internal', venue,
          scheduled_date, duration_hours, max_nominees, notes } = req.body;
  if (!title) return res.json({ success: false, message: 'title required' });
  const { rows } = await pool.query(
    `INSERT INTO training_programs
       (title, category, trainer_name, trainer_type, venue,
        scheduled_date, duration_hours, max_nominees, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [title, category||null, trainer_name||null, trainer_type, venue||null,
     scheduled_date||null, duration_hours||null, max_nominees||null, notes||null, req.user.id]
  );
  res.json({ success: true, data: rows[0] });
}));

// PUT /training/:id — update program (status, dates)
router.put('/training/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { status, scheduled_date, venue, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE training_programs
     SET status=COALESCE($1,status), scheduled_date=COALESCE($2,scheduled_date),
         venue=COALESCE($3,venue), notes=COALESCE($4,notes)
     WHERE id=$5 RETURNING *`,
    [status||null, scheduled_date||null, venue||null, notes||null, req.params.id]
  );
  res.json({ success: !!rows.length, data: rows[0] });
}));

// GET /training/:id/attendance — nominee list
router.get('/training/:id/attendance', auth, requireLevel(2), ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ta.*, e.name AS "employeeName", e.employee_code AS "employeeCode",
            d.name AS "deptName"
     FROM training_attendance ta
     JOIN employees e ON e.id=ta.employee_id
     LEFT JOIN departments d ON d.id=e.department_id
     WHERE ta.training_id=$1 ORDER BY e.name`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
}));

// POST /training/:id/nominate — nominate employee(s)
router.post('/training/:id/nominate', auth, requireLevel(2), ar(async (req, res) => {
  const { employee_ids = [] } = req.body;
  if (!employee_ids.length) return res.json({ success: false, message: 'employee_ids[] required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let added = 0;
    for (const eid of employee_ids) {
      const { rows } = await client.query(
        `INSERT INTO training_attendance (training_id, employee_id, nominated_by)
         VALUES ($1,$2,$3) ON CONFLICT (training_id,employee_id) DO NOTHING RETURNING id`,
        [req.params.id, eid, req.user.id]
      );
      if (rows.length) added++;
    }
    await client.query('COMMIT');
    res.json({ success: true, added });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// PUT /training/:id/attendance/:ta_id — mark attended/absent + feedback
router.put('/training/:id/attendance/:ta_id', auth, requireLevel(2), ar(async (req, res) => {
  const { status, feedback, score, attended_on } = req.body;
  const { rows } = await pool.query(
    `UPDATE training_attendance
     SET status=COALESCE($1,status), feedback=$2, score=$3,
         attended_on=COALESCE($4,attended_on)
     WHERE id=$5 AND training_id=$6 RETURNING *`,
    [status||null, feedback||null, score||null, attended_on||null, req.params.ta_id, req.params.id]
  );
  res.json({ success: !!rows.length, data: rows[0] });
}));

// ─── Ph16-J: EMPLOYEE DOCUMENTS ──────────────────────────────────────────────

// GET /documents/:emp_id — list documents for employee
router.get('/documents/:emp_id', auth, ar(async (req, res) => {
  const emp = await getEmpId(req.user.id);
  const isOwn = emp && String(emp.id) === String(req.params.emp_id);
  if (!isOwn && (req.user.role_level || 0) < 2)
    return res.status(403).json({ success: false, message: 'Access denied' });
  const { is_confidential } = req.query;
  const lvl = req.user.role_level;
  // confidential docs only for HR Admin / L4+
  const canSeeConfidential = (req.user.dept_code === 'HR' && lvl >= 3) || lvl >= 4;
  const confFilter = canSeeConfidential ? '' : `AND is_confidential=false`;
  const { rows } = await pool.query(
    `SELECT id, doc_type AS "docType", doc_name AS "docName",
            file_url AS "fileUrl", file_size_kb AS "fileSizeKb",
            valid_from AS "validFrom", valid_to AS "validTo",
            is_confidential AS "isConfidential", notes, created_at AS "createdAt"
     FROM employee_documents
     WHERE employee_id=$1 ${confFilter}
     ORDER BY created_at DESC`,
    [req.params.emp_id]
  );
  res.json({ success: true, data: rows });
}));

// POST /documents/:emp_id — upload doc (stores URL — actual file upload handled by frontend to storage)
router.post('/documents/:emp_id', auth, requireLevel(3), ar(async (req, res) => {
  const { doc_type, doc_name, file_url, file_size_kb, valid_from, valid_to, is_confidential=false, notes } = req.body;
  if (!doc_type || !doc_name || !file_url)
    return res.json({ success: false, message: 'doc_type, doc_name, file_url required' });
  const { rows } = await pool.query(
    `INSERT INTO employee_documents
       (employee_id, doc_type, doc_name, file_url, file_size_kb,
        uploaded_by, valid_from, valid_to, is_confidential, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.params.emp_id, doc_type, doc_name, file_url, file_size_kb||null,
     req.user.id, valid_from||null, valid_to||null, is_confidential, notes||null]
  );
  res.json({ success: true, data: rows[0] });
}));

// DELETE /documents/:emp_id/:doc_id — soft: remove record (not file)
router.delete('/documents/:emp_id/:doc_id', auth, requireLevel(3), ar(async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM employee_documents WHERE id=$1 AND employee_id=$2 RETURNING id`,
    [req.params.doc_id, req.params.emp_id]
  );
  res.json({ success: !!rows.length });
}));

// ─── Ph16-K: ONBOARDING CHECKLIST ────────────────────────────────────────────

// POST /onboarding/:emp_id/init — create checklist from master tasks for a new joiner
router.post('/onboarding/:emp_id/init', auth, requireLevel(3), ar(async (req, res) => {
  const { doj } = req.body; // date of joining to compute due dates
  const joinDate = doj ? new Date(doj) : new Date();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: tasks } = await client.query(
      `SELECT * FROM onboarding_tasks_master WHERE is_active=true ORDER BY sort_order`
    );
    let created = 0;
    for (const t of tasks) {
      const due = new Date(joinDate);
      due.setDate(due.getDate() + (t.due_days || 0));
      const { rows } = await client.query(
        `INSERT INTO onboarding_checklist (employee_id, task_id, due_date)
         VALUES ($1,$2,$3) ON CONFLICT (employee_id,task_id) DO NOTHING RETURNING id`,
        [req.params.emp_id, t.id, due.toISOString().slice(0, 10)]
      );
      if (rows.length) created++;
    }
    await client.query('COMMIT');
    res.json({ success: true, created, total: tasks.length });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// GET /onboarding/:emp_id — get checklist with task details
router.get('/onboarding/:emp_id', auth, ar(async (req, res) => {
  const emp = await getEmpId(req.user.id);
  const isOwn = emp && String(emp.id) === String(req.params.emp_id);
  if (!isOwn && (req.user.role_level || 0) < 2)
    return res.status(403).json({ success: false, message: 'Access denied' });
  const { rows } = await pool.query(
    `SELECT oc.id, oc.status, oc.due_date AS "dueDate",
            oc.completed_on AS "completedOn", oc.notes,
            otm.task_title AS "taskTitle", otm.responsible, otm.due_days AS "dueDays"
     FROM onboarding_checklist oc
     JOIN onboarding_tasks_master otm ON otm.id=oc.task_id
     WHERE oc.employee_id=$1
     ORDER BY otm.sort_order`,
    [req.params.emp_id]
  );
  const summary = {
    total:   rows.length,
    done:    rows.filter(r => r.status === 'Done').length,
    pending: rows.filter(r => r.status === 'Pending').length,
    pct:     rows.length ? Math.round(rows.filter(r => r.status === 'Done').length / rows.length * 100) : 0,
  };
  res.json({ success: true, data: rows, summary });
}));

// PUT /onboarding/:emp_id/:item_id — update task status
router.put('/onboarding/:emp_id/:item_id', auth, requireLevel(2), ar(async (req, res) => {
  const { status, notes } = req.body;
  if (!status) return res.json({ success: false, message: 'status required' });
  const { rows } = await pool.query(
    `UPDATE onboarding_checklist
     SET status=$1, notes=$2,
         completed_by=CASE WHEN $1='Done' THEN $3 ELSE completed_by END,
         completed_on=CASE WHEN $1='Done' THEN now() ELSE completed_on END
     WHERE id=$4 AND employee_id=$5 RETURNING *`,
    [status, notes||null, req.user.id, req.params.item_id, req.params.emp_id]
  );
  res.json({ success: !!rows.length, data: rows[0] });
}));

// ─── Ph16-L: SEPARATION & F&F ────────────────────────────────────────────────

// POST /separation — initiate separation
router.post('/separation', auth, requireLevel(2), ar(async (req, res) => {
  const { employee_id, separation_type, resignation_date, last_working_date, reason } = req.body;
  if (!employee_id || !separation_type)
    return res.json({ success: false, message: 'employee_id and separation_type required' });

  const lvl = req.user.role_level;
  const emp = await getEmpId(req.user.id);
  // employee can initiate own resignation; L3+ can initiate for others
  const isSelf = emp && String(emp.id) === String(employee_id);
  if (!isSelf && lvl < 3)
    return res.status(403).json({ success: false, message: 'Cannot initiate separation for others' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // get employee for gratuity calc
    const { rows: empRows } = await client.query(
      `SELECT e.*, e.basic_salary FROM employees e WHERE e.id=$1`, [employee_id]
    );
    if (!empRows.length) { await client.query('ROLLBACK'); return res.json({ success: false, message: 'Employee not found' }); }
    const e = empRows[0];

    // gratuity: 15/26 × basic × service_years (min 5 years service)
    const doj = e.doj ? new Date(e.doj) : null;
    const lwdDate = last_working_date ? new Date(last_working_date) : new Date();
    const serviceYears = doj ? parseFloat(((lwdDate - doj) / (365.25 * 24 * 3600 * 1000)).toFixed(2)) : 0;
    const gratuity = serviceYears >= 5
      ? Math.round((15 / 26) * parseFloat(e.basic_salary || 0) * serviceYears)
      : 0;

    const { rows: sepRows } = await client.query(
      `INSERT INTO separation_records
         (employee_id, separation_type, resignation_date, last_working_date,
          reason, service_years, gratuity_amount, initiated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [employee_id, separation_type, resignation_date||null, last_working_date||null,
       reason||null, serviceYears, gratuity, req.user.id]
    );
    const sep = sepRows[0];

    // seed clearance items
    await client.query(`SELECT seed_clearance_items($1)`, [sep.id]);

    await client.query('COMMIT');
    res.json({ success: true, data: sep, gratuity, serviceYears });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// GET /separation — list (HR Admin sees all, others see own)
router.get('/separation', auth, ar(async (req, res) => {
  const { status } = req.query;
  const lvl = req.user.role_level;
  const isHRAdmin = (req.user.dept_code === 'HR' || req.user.department === 'HR & Payroll') && lvl >= 3;
  const canSeeAll = isHRAdmin || lvl >= 4;

  const conds = []; const params = []; let p = 1;
  if (!canSeeAll) {
    const emp = await getEmpId(req.user.id);
    if (!emp) return res.json({ success: true, data: [] });
    conds.push(`sr.employee_id=$${p++}`); params.push(emp.id);
  }
  if (status) { conds.push(`sr.status=$${p++}`); params.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT sr.*, e.name AS "employeeName", e.employee_code AS "employeeCode",
            d.name AS "deptName",
            u1.name AS "initiatedBy", u2.name AS "approvedBy"
     FROM separation_records sr
     JOIN employees e ON e.id=sr.employee_id
     LEFT JOIN departments d ON d.id=e.department_id
     LEFT JOIN users u1 ON u1.id=sr.initiated_by
     LEFT JOIN users u2 ON u2.id=sr.approved_by
     ${where}
     ORDER BY sr.created_at DESC LIMIT 100`,
    params
  );
  res.json({ success: true, data: rows });
}));

// GET /separation/:id/clearance — clearance checklist
router.get('/separation/:id/clearance', auth, requireLevel(2), ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ci.*, u.name AS "clearedBy"
     FROM clearance_items ci
     LEFT JOIN users u ON u.id=ci.cleared_by
     WHERE ci.separation_id=$1 ORDER BY ci.id`,
    [req.params.id]
  );
  const summary = { total: rows.length, cleared: rows.filter(r=>r.status==='Cleared').length };
  res.json({ success: true, data: rows, summary });
}));

// PUT /separation/:id/clearance/:item_id — dept marks item cleared
router.put('/separation/:id/clearance/:item_id', auth, requireLevel(2), ar(async (req, res) => {
  const { status, remarks } = req.body;
  if (!status) return res.json({ success: false, message: 'status required' });
  const { rows } = await pool.query(
    `UPDATE clearance_items
     SET status=$1, remarks=$2,
         cleared_by=CASE WHEN $1='Cleared' THEN $3 ELSE cleared_by END,
         cleared_on=CASE WHEN $1='Cleared' THEN now() ELSE cleared_on END
     WHERE id=$4 AND separation_id=$5 RETURNING *`,
    [status, remarks||null, req.user.id, req.params.item_id, req.params.id]
  );
  res.json({ success: !!rows.length, data: rows[0] });
}));

// PUT /separation/:id/approve — HR Admin / L4 approves separation
router.put('/separation/:id/approve', auth, requireLevel(3), ar(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE separation_records
     SET status='FF Pending', approved_by=$1
     WHERE id=$2 AND status='Initiated' RETURNING id`,
    [req.user.id, req.params.id]
  );
  res.json({ success: !!rows.length, message: rows.length ? 'Approved — F&F pending' : 'Not found / already actioned' });
}));

// PUT /separation/:id/complete — mark F&F settled + deactivate employee
router.put('/separation/:id/complete', auth, requireLevel(4), ar(async (req, res) => {
  const { leave_encashment=0, bonus_payable=0, deductions=0, ff_paid_date, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: sepRows } = await client.query(
      `SELECT * FROM separation_records WHERE id=$1`, [req.params.id]
    );
    if (!sepRows.length) { await client.query('ROLLBACK'); return res.json({ success: false, message: 'Not found' }); }
    const sep = sepRows[0];

    // Block completion if any clearance checklist items are pending
    const { rows: pendingItems } = await client.query(
      `SELECT COUNT(*)::int AS count FROM clearance_items WHERE separation_id = $1 AND status != 'Cleared'`,
      [sep.id]
    );
    if (pendingItems[0].count > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cannot complete separation: clearance checklist items are pending' });
    }

    const netFF = parseFloat(sep.gratuity_amount||0) + parseFloat(leave_encashment) + parseFloat(bonus_payable) - parseFloat(deductions);

    await client.query(
      `UPDATE separation_records
       SET status='Completed', leave_encashment=$1, bonus_payable=$2,
           deductions=$3, net_ff_amount=$4, ff_paid_date=$5, closed_by=$6
       WHERE id=$7`,
      [leave_encashment, bonus_payable, deductions, netFF, ff_paid_date||null, req.user.id, sep.id]
    );

    // deactivate employee
    await client.query(`UPDATE employees SET is_active=false WHERE id=$1`, [sep.employee_id]);

    await client.query('COMMIT');
    res.json({ success: true, netFF, message: 'F&F completed. Employee deactivated.' });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// ─── Ph16-H: APPRAISAL CYCLE ─────────────────────────────────────────────────

// GET /appraisals/cycles — list all cycles
router.get('/appraisals/cycles', auth, requireLevel(2), ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ac.*, u.name AS "createdBy"
     FROM appraisal_cycles ac LEFT JOIN users u ON u.id=ac.created_by
     ORDER BY ac.year DESC, ac.start_date DESC`
  );
  res.json({ success: true, data: rows });
}));

// POST /appraisals/cycles — HR Admin creates cycle
router.post('/appraisals/cycles', auth, requireLevel(3), ar(async (req, res) => {
  const { name, year, cycle_type='Annual', start_date, end_date,
          goal_set_deadline, self_review_deadline, manager_review_deadline } = req.body;
  if (!name || !year || !start_date || !end_date)
    return res.json({ success: false, message: 'name, year, start_date, end_date required' });
  const { rows } = await pool.query(
    `INSERT INTO appraisal_cycles
       (name, year, cycle_type, start_date, end_date,
        goal_set_deadline, self_review_deadline, manager_review_deadline, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name, year, cycle_type, start_date, end_date,
     goal_set_deadline||null, self_review_deadline||null, manager_review_deadline||null, req.user.id]
  );
  res.json({ success: true, data: rows[0] });
}));

// PUT /appraisals/cycles/:id — update status or dates
router.put('/appraisals/cycles/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { status, goal_set_deadline, self_review_deadline, manager_review_deadline } = req.body;
  const { rows } = await pool.query(
    `UPDATE appraisal_cycles
     SET status=COALESCE($1,status),
         goal_set_deadline=COALESCE($2,goal_set_deadline),
         self_review_deadline=COALESCE($3,self_review_deadline),
         manager_review_deadline=COALESCE($4,manager_review_deadline)
     WHERE id=$5 RETURNING *`,
    [status||null, goal_set_deadline||null, self_review_deadline||null,
     manager_review_deadline||null, req.params.id]
  );
  res.json({ success: !!rows.length, data: rows[0] });
}));

// GET /appraisals/goals — own goals (or team if L3+)
router.get('/appraisals/goals', auth, ar(async (req, res) => {
  const { cycle_id, employee_id } = req.query;
  const lvl = req.user.role_level;
  const emp = await getEmpId(req.user.id);

  let targetEmpId = emp?.id;
  if (employee_id && lvl >= 2) targetEmpId = employee_id; // L2+ can view others
  if (!targetEmpId) return res.json({ success: true, data: [] });

  const conds = [`ag.employee_id=$1`]; const params = [targetEmpId]; let p = 2;
  if (cycle_id) { conds.push(`ag.cycle_id=$${p++}`); params.push(cycle_id); }

  const { rows } = await pool.query(
    `SELECT ag.*, ac.name AS "cycleName", ac.year
     FROM appraisal_goals ag
     JOIN appraisal_cycles ac ON ac.id = ag.cycle_id
     WHERE ${conds.join(' AND ')}
     ORDER BY ag.created_at DESC`,
    params
  );
  res.json({ success: true, data: rows });
}));

// POST /appraisals/goals — L3+ dept head sets goals for employee
router.post('/appraisals/goals', auth, requireLevel(3), ar(async (req, res) => {
  const { cycle_id, employee_id, goal_title, description, weightage=0, kpi_target } = req.body;
  if (!cycle_id || !employee_id || !goal_title)
    return res.json({ success: false, message: 'cycle_id, employee_id, goal_title required' });
  const { rows } = await pool.query(
    `INSERT INTO appraisal_goals
       (cycle_id, employee_id, goal_title, description, weightage, kpi_target, set_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [cycle_id, employee_id, goal_title, description||null, weightage, kpi_target||null, req.user.id]
  );
  res.json({ success: true, data: rows[0] });
}));

// PUT /appraisals/goals/:id/self-rate — employee submits self rating + actual KPI
router.put('/appraisals/goals/:id/self-rate', auth, ar(async (req, res) => {
  const { self_rating, kpi_actual } = req.body;
  if (!self_rating) return res.json({ success: false, message: 'self_rating required (1.0–5.0)' });
  const emp = await getEmpId(req.user.id);
  const { rows } = await pool.query(
    `UPDATE appraisal_goals
     SET self_rating=$1, kpi_actual=$2
     WHERE id=$3 AND employee_id=$4 RETURNING id`,
    [parseFloat(self_rating), kpi_actual||null, req.params.id, emp?.id]
  );
  res.json({ success: !!rows.length, message: rows.length ? 'Self rating saved' : 'Not found / access denied' });
}));

// PUT /appraisals/goals/:id/manager-rate — L3+ manager rates + finalizes
router.put('/appraisals/goals/:id/manager-rate', auth, requireLevel(3), ar(async (req, res) => {
  const { manager_rating, final_rating } = req.body;
  if (!manager_rating) return res.json({ success: false, message: 'manager_rating required' });
  const { rows } = await pool.query(
    `UPDATE appraisal_goals
     SET manager_rating=$1, final_rating=COALESCE($2,($1+self_rating)/2)
     WHERE id=$3 RETURNING *`,
    [parseFloat(manager_rating), final_rating ? parseFloat(final_rating) : null, req.params.id]
  );
  res.json({ success: !!rows.length, data: rows[0] });
}));

// ─── Ph16-G: ATTENDANCE REGULARIZATION ───────────────────────────────────────

// POST /attendance/regularize — employee requests correction for a past date
router.post('/attendance/regularize', auth, ar(async (req, res) => {
  const emp = await getEmpId(req.user.id);
  if (!emp) return res.json({ success: false, message: 'No employee record linked' });
  const { attendance_date, in_time, out_time, reason } = req.body;
  if (!attendance_date || !reason)
    return res.json({ success: false, message: 'attendance_date and reason required' });

  const { rows } = await pool.query(
    `INSERT INTO attendance_regularization
       (employee_id, attendance_date, in_time, out_time, reason)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [emp.id, attendance_date, in_time || null, out_time || null, reason]
  );
  res.json({ success: true, data: rows[0] });
}));

// GET /attendance/regularize/team — supervisor sees pending requests for their dept
router.get('/attendance/regularize/team', auth, requireLevel(2), ar(async (req, res) => {
  const { status = 'Pending' } = req.query;
  const lvl = req.user.role_level;
  const isHRAdmin = (req.user.dept_code === 'HR' || req.user.department === 'HR & Payroll') && lvl >= 3;
  const canSeeAll = isHRAdmin || lvl >= 4;

  let deptFilter = '';
  const params = [status];
  if (!canSeeAll) {
    const emp = await getEmpId(req.user.id);
    if (emp?.department_id) {
      deptFilter = `AND e.department_id = $2`;
      params.push(emp.department_id);
    }
  }

  const { rows } = await pool.query(
    `SELECT ar.id, ar.attendance_date AS "attendanceDate",
            ar.in_time AS "inTime", ar.out_time AS "outTime",
            ar.reason, ar.status, ar.applied_on AS "appliedOn",
            ar.rejection_reason AS "rejectionReason",
            e.name AS "employeeName", e.employee_code AS "employeeCode",
            d.name AS "deptName",
            a.status AS "currentStatus", a.in_time AS "currentIn", a.out_time AS "currentOut"
     FROM attendance_regularization ar
     JOIN employees e ON e.id = ar.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN attendance a ON a.employee_id = ar.employee_id AND a.date = ar.attendance_date
     WHERE ar.status = $1 ${deptFilter}
     ORDER BY ar.applied_on DESC LIMIT 200`,
    params
  );
  res.json({ success: true, data: rows });
}));

// GET /attendance/regularize/my — own regularization history
router.get('/attendance/regularize/my', auth, ar(async (req, res) => {
  const emp = await getEmpId(req.user.id);
  if (!emp) return res.json({ success: true, data: [] });
  const { rows } = await pool.query(
    `SELECT ar.id, ar.attendance_date AS "attendanceDate",
            ar.in_time AS "inTime", ar.out_time AS "outTime",
            ar.reason, ar.status, ar.applied_on AS "appliedOn",
            ar.rejection_reason AS "rejectionReason"
     FROM attendance_regularization ar
     WHERE ar.employee_id = $1
     ORDER BY ar.applied_on DESC LIMIT 50`,
    [emp.id]
  );
  res.json({ success: true, data: rows });
}));

// PUT /attendance/regularize/:id/approve — L2+ approves + patches attendance record
router.put('/attendance/regularize/:id/approve', auth, requireLevel(2), ar(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: reqRows } = await client.query(
      `SELECT ar.*, e.department_id FROM attendance_regularization ar
       JOIN employees e ON e.id = ar.employee_id
       WHERE ar.id=$1 AND ar.status='Pending'`,
      [req.params.id]
    );
    if (!reqRows.length) {
      await client.query('ROLLBACK');
      return res.json({ success: false, message: 'Request not found or already actioned' });
    }
    const r = reqRows[0];

    // Dept isolation guard — same pattern as leave approve above
    const lvl2 = req.user.role_level || 0;
    if (!(req.user.is_hr_admin || lvl2 >= 4) && r.department_id !== req.user.department_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Access denied — outside your department' });
    }

    // compute hours if both times provided
    let hours = null;
    if (r.in_time && r.out_time) {
      const [ih, im] = r.in_time.split(':').map(Number);
      const [oh, om] = r.out_time.split(':').map(Number);
      hours = parseFloat(((oh * 60 + om) - (ih * 60 + im)) / 60).toFixed(2);
    }

    // patch attendance record
    await client.query(
      `INSERT INTO attendance (employee_id, date, in_time, out_time, hours_worked, remarks)
       VALUES ($1,$2,$3,$4,$5,'Regularized')
       ON CONFLICT (employee_id, date) DO UPDATE
         SET in_time=EXCLUDED.in_time, out_time=EXCLUDED.out_time,
             hours_worked=EXCLUDED.hours_worked, remarks='Regularized'`,
      [r.employee_id, r.attendance_date, r.in_time, r.out_time, hours]
    );

    // approve request
    await client.query(
      `UPDATE attendance_regularization
       SET status='Approved', approved_by=$1, approved_on=now()
       WHERE id=$2`,
      [req.user.id, r.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Regularization approved and attendance updated' });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// PUT /attendance/regularize/:id/reject
router.put('/attendance/regularize/:id/reject', auth, requireLevel(2), ar(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.json({ success: false, message: 'Rejection reason required' });
  const { rows } = await pool.query(
    `UPDATE attendance_regularization
     SET status='Rejected', approved_by=$1, approved_on=now(), rejection_reason=$2
     WHERE id=$3 AND status='Pending' RETURNING id`,
    [req.user.id, reason, req.params.id]
  );
  res.json({ success: !!rows.length, message: rows.length ? 'Rejected' : 'Not found / already actioned' });
}));

// ─── Ph16-F: PAYROLL ENGINE V2 ───────────────────────────────────────────────

// GET /payroll/runs — list all payroll runs
router.get('/payroll/runs', auth, requireLevel(2), ar(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT pr.id, pr.month, pr.status,
            pr.total_employees AS "totalEmployees",
            pr.total_gross AS "totalGross",
            pr.total_deductions AS "totalDeductions",
            pr.total_net AS "totalNet",
            pr.created_at AS "createdAt",
            pr.approved_at AS "approvedAt",
            pr.paid_at AS "paidAt",
            u1.name AS "generatedBy",
            u2.name AS "approvedBy"
     FROM payroll_runs pr
     LEFT JOIN users u1 ON u1.id = pr.generated_by
     LEFT JOIN users u2 ON u2.id = pr.approved_by
     ORDER BY pr.month DESC LIMIT 36`
  );
  res.json({ success: true, data: rows });
}));

// POST /payroll/runs — generate payroll run for a month
// Reads salary_structures assignment → computes breakdown → inserts payroll_details
router.post('/payroll/runs', auth, requireLevel(3), ar(async (req, res) => {
  const { month, working_days = 26 } = req.body;
  if (!month || !/^\d{4}-\d{2}$/.test(month))
    return res.json({ success: false, message: 'month YYYY-MM required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert payroll run header
    const { rows: runRows } = await client.query(
      `INSERT INTO payroll_runs (month, status, generated_by)
       VALUES ($1, 'Draft', $2)
       ON CONFLICT (month) DO UPDATE SET status='Draft', generated_by=$2, created_at=now()
       RETURNING id`,
      [month + '-01', req.user.id]
    );
    const runId = runRows[0].id;

    // delete previous draft details for re-generation
    await client.query(`DELETE FROM payroll_details WHERE payroll_run_id=$1`, [runId]);

    // all active employees
    const { rows: emps } = await client.query(
      `SELECT e.id, e.name, e.basic_salary, e.department_id FROM employees e WHERE e.is_active=true`
    );

    const yr  = parseInt(month.split('-')[0]);
    const mo  = parseInt(month.split('-')[1]);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const startDate   = `${month}-01`;
    const endDate     = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    let totGross = 0; let totDed = 0; let totNet = 0;

    for (const emp of emps) {
      // get salary structure assigned to this employee (current)
      const { rows: strRows } = await client.query(
        `SELECT ss.* FROM employee_salary_assignments esa
         JOIN salary_structures ss ON ss.id = esa.salary_structure_id
         WHERE esa.employee_id = $1
           AND esa.effective_from <= $2
           AND (esa.effective_to IS NULL OR esa.effective_to >= $2)
         ORDER BY esa.effective_from DESC LIMIT 1`,
        [emp.id, startDate]
      );
      const structure = strRows[0] || null;

      // attendance counts
      const { rows: attRows } = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('Present','OT')) AS present,
           COUNT(*) FILTER (WHERE status = 'Half Day')        AS half,
           COUNT(*) FILTER (WHERE status = 'Absent')         AS absent,
           COUNT(*) FILTER (WHERE status = 'Leave')          AS on_leave,
           COUNT(*) FILTER (WHERE status = 'Holiday')        AS holiday,
           SUM(CASE WHEN status='OT' THEN COALESCE(hours_worked,0) ELSE 0 END) AS ot_hours
         FROM attendance
         WHERE employee_id=$1 AND date BETWEEN $2 AND $3`,
        [emp.id, startDate, endDate]
      );
      const att = attRows[0];
      const presentDays = parseInt(att.present || 0) + parseFloat(att.half || 0) * 0.5;
      const lopDays     = Math.max(0, parseInt(working_days) - presentDays - parseInt(att.on_leave || 0) - parseInt(att.holiday || 0));
      const otHours     = parseFloat(att.ot_hours || 0);

      // compute breakdown
      const basic = parseFloat(emp.basic_salary || 0);
      const bd = computeSalaryBreakdown(basic, structure);

      // pro-rata for LOP
      const lopDeduct = lopDays > 0 ? Math.round((bd.gross / parseInt(working_days)) * lopDays) : 0;
      const grossAfterLop = bd.gross - lopDeduct;

      // OT amount (hourly = basic / 26 / 8 × 2 for OT rate)
      const otAmount = otHours > 0 ? Math.round((basic / 26 / 8) * 2 * otHours) : 0;

      // TDS estimation: annual gross projected × 20% bracket / 12 (simplified)
      const annualGross   = grossAfterLop * 12;
      const taxableIncome = Math.max(0, annualGross - 250000); // basic exemption
      const annualTax     = taxableIncome <= 250000 ? 0
        : taxableIncome <= 500000 ? taxableIncome * 0.05
        : taxableIncome <= 1000000 ? 12500 + (taxableIncome - 500000) * 0.20
        : 112500 + (taxableIncome - 1000000) * 0.30;
      const tds = Math.round((annualTax / 12) * 1.04); // + 4% cess

      const totalDed = bd.pf_employee + bd.esic_employee + bd.professional_tax + tds;
      const netPay   = Math.round(grossAfterLop + otAmount - totalDed);

      totGross += grossAfterLop + otAmount;
      totDed   += totalDed;
      totNet   += netPay;

      await client.query(
        `INSERT INTO payroll_details
           (payroll_run_id, employee_id, salary_structure_id,
            working_days, present_days, lop_days,
            basic, hra, da, conveyance, medical, special_allowance, overtime_amount, gross_salary,
            pf_employee, pf_employer, esic_employee, esic_employer, professional_tax, tds,
            total_deductions, net_salary, payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'Draft')
         ON CONFLICT (payroll_run_id, employee_id) DO UPDATE SET
           working_days=$4, present_days=$5, lop_days=$6,
           basic=$7, hra=$8, da=$9, conveyance=$10, medical=$11, special_allowance=$12,
           overtime_amount=$13, gross_salary=$14,
           pf_employee=$15, pf_employer=$16, esic_employee=$17, esic_employer=$18,
           professional_tax=$19, tds=$20, total_deductions=$21, net_salary=$22`,
        [runId, emp.id, structure?.id || null,
         parseInt(working_days), Math.round(presentDays), Math.round(lopDays),
         bd.basic, bd.hra, bd.da, bd.conveyance, bd.medical, bd.special_allowance,
         otAmount, Math.round(grossAfterLop + otAmount),
         bd.pf_employee, bd.pf_employer, bd.esic_employee, bd.esic_employer, bd.professional_tax, tds,
         totalDed, netPay]
      );
    }

    // update run totals
    await client.query(
      `UPDATE payroll_runs SET
         total_employees=$1, total_gross=$2, total_deductions=$3, total_net=$4
       WHERE id=$5`,
      [emps.length, Math.round(totGross), Math.round(totDed), Math.round(totNet), runId]
    );

    await client.query('COMMIT');
    res.json({ success: true, runId, employees: emps.length, totalNet: Math.round(totNet) });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// GET /payroll/runs/:id — run header + all employee details
router.get('/payroll/runs/:id', auth, requireLevel(2), ar(async (req, res) => {
  const { rows: run } = await pool.query(
    `SELECT pr.*, u1.name AS "generatedBy", u2.name AS "approvedBy", u3.name AS "paidBy"
     FROM payroll_runs pr
     LEFT JOIN users u1 ON u1.id=pr.generated_by
     LEFT JOIN users u2 ON u2.id=pr.approved_by
     LEFT JOIN users u3 ON u3.id=pr.paid_by
     WHERE pr.id=$1`, [req.params.id]
  );
  if (!run.length) return res.json({ success: false, message: 'Run not found' });

  const { rows: details } = await pool.query(
    `SELECT pd.*,
            e.name AS "employeeName", e.employee_code AS "employeeCode",
            d.name AS "deptName", ss.name AS "structureName"
     FROM payroll_details pd
     JOIN employees e ON e.id = pd.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN salary_structures ss ON ss.id = pd.salary_structure_id
     WHERE pd.payroll_run_id=$1
     ORDER BY e.name`, [req.params.id]
  );
  res.json({ success: true, run: run[0], data: details });
}));

// PUT /payroll/runs/:id/approve — L4 Plant Head approves
router.put('/payroll/runs/:id/approve', auth, requireLevel(4), ar(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE payroll_runs
     SET status='Approved', approved_by=$1, approved_at=now()
     WHERE id=$2 AND status='Draft' RETURNING id, month, total_net AS "totalNet"`,
    [req.user.id, req.params.id]
  );
  if (!rows.length) return res.json({ success: false, message: 'Run not found or already approved' });
  await pool.query(
    `UPDATE payroll_details SET payment_status='Approved' WHERE payroll_run_id=$1`, [req.params.id]
  );
  res.json({ success: true, data: rows[0] });
}));

// PUT /payroll/runs/:id/pay — L3+ HR marks all as paid
router.put('/payroll/runs/:id/pay', auth, requireLevel(3), ar(async (req, res) => {
  const { payment_date } = req.body;
  const pd = payment_date || new Date().toISOString().slice(0, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [run] } = await client.query(`SELECT approved_by FROM payroll_runs WHERE id=$1 AND status='Approved'`, [req.params.id]);
    if (run && run.approved_by === req.user.id && req.user.role_level < 5) {
      await client.query('ROLLBACK');
      return res.json({ success: false, message: 'Cannot release payment for a run you approved yourself — needs different user (or admin override)' });
    }
    const { rows } = await client.query(
      `UPDATE payroll_runs
       SET status='Paid', paid_by=$1, paid_at=now()
       WHERE id=$2 AND status='Approved' RETURNING id`,
      [req.user.id, req.params.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.json({ success: false, message: 'Run not found or not in Approved state' });
    }
    await client.query(
      `UPDATE payroll_details
       SET payment_status='Paid', payment_date=$1 WHERE payroll_run_id=$2`,
      [pd, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Payroll marked paid', paidDate: pd });
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// GET /payroll/runs/:id/slip/:emp_id — single employee payslip from run
router.get('/payroll/runs/:id/slip/:emp_id', auth, ar(async (req, res) => {
  // allow own payslip at any level; supervisors+ can see others
  const { rows } = await pool.query(
    `SELECT pd.*,
            e.name AS "employeeName", e.employee_code AS "employeeCode",
            e.bank_account AS "bankAccount", e.bank_name AS "bankName",
            e.ifsc, e.pf_number AS "pfNumber", e.pan,
            d.name AS "deptName",
            ss.name AS "structureName", ss.grade,
            pr.month, pr.status AS "runStatus"
     FROM payroll_details pd
     JOIN employees e ON e.id = pd.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN salary_structures ss ON ss.id = pd.salary_structure_id
     JOIN payroll_runs pr ON pr.id = pd.payroll_run_id
     WHERE pd.payroll_run_id=$1 AND pd.employee_id=$2`,
    [req.params.id, req.params.emp_id]
  );
  if (!rows.length) return res.json({ success: false, message: 'Payslip not found' });

  // only own slip or L2+
  const emp = await getEmpId(req.user.id);
  const isOwn = emp && String(emp.id) === String(req.params.emp_id);
  if (!isOwn && (req.user.role_level || 0) < 2)
    return res.status(403).json({ success: false, message: 'Access denied' });

  res.json({ success: true, data: rows[0] });
}));

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

// GET /notifications — own unread (or all with ?all=1)
router.get('/notifications', auth, ar(async (req, res) => {
  const all = req.query.all === '1';
  const { rows } = await pool.query(
    `SELECT id, type, title, message, ref_table AS "refTable", ref_id AS "refId",
            is_read AS "isRead", created_at AS "createdAt"
     FROM notifications
     WHERE user_id=$1 ${all ? '' : "AND is_read=false"}
     ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false`, [req.user.id]
  );
  res.json({ success: true, data: rows, unreadCount: parseInt(cnt[0].count) });
}));

// PUT /notifications/read-all — mark all read
router.put('/notifications/read-all', auth, ar(async (req, res) => {
  await pool.query(`UPDATE notifications SET is_read=true WHERE user_id=$1`, [req.user.id]);
  res.json({ success: true });
}));

// PUT /notifications/:id/read — mark one read
router.put('/notifications/:id/read', auth, ar(async (req, res) => {
  await pool.query(`UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
  res.json({ success: true });
}));

// ─── FORM 16 PDF (TDS CERTIFICATE) ──────────────────────────────────────────

router.get('/form16/:emp_id/:year', auth, ar(async (req, res) => {
  const { emp_id, year } = req.params;

  // Access: own (any level) or HR Admin/L4+
  const requestingEmp = await pool.query(
    `SELECT id FROM employees WHERE user_id=$1 AND is_active=true LIMIT 1`, [req.user.id]
  );
  const isOwn = requestingEmp.rows[0]?.id === parseInt(emp_id);
  const isHRAdmin = (req.user.dept_code === 'HR' || req.user.department === 'HR & Payroll') && req.user.role_level >= 3;
  if (!isOwn && !isHRAdmin && req.user.role_level < 4)
    return res.status(403).json({ success: false, message: 'Access denied' });

  // Employee details
  const { rows: empRows } = await pool.query(
    `SELECT e.*, d.name AS dept_name FROM employees e
     LEFT JOIN departments d ON d.id=e.department_id
     WHERE e.id=$1`, [emp_id]
  );
  if (!empRows.length) return res.status(404).json({ success: false, message: 'Employee not found' });
  const emp = empRows[0];

  // Payroll data for FY (April prev_year → March year)
  const fyStart = `${parseInt(year)-1}-04-01`;
  const fyEnd   = `${year}-03-31`;

  // Try Ph16 payroll_details first, fallback to legacy
  let months = [];
  try {
    const { rows } = await pool.query(
      `SELECT TO_CHAR(pr.month,'Mon YYYY') AS period,
              pd.gross_salary, pd.tds, pd.pf_employee,
              pd.professional_tax, pd.net_salary, pd.present_days
       FROM payroll_details pd
       JOIN payroll_runs pr ON pr.id=pd.payroll_run_id
       WHERE pd.employee_id=$1
         AND pr.month BETWEEN $2 AND $3
         AND pr.status IN ('Approved','Paid')
       ORDER BY pr.month`,
      [emp_id, fyStart, fyEnd]
    );
    months = rows;
  } catch (_) {}

  if (!months.length) {
    const { rows } = await pool.query(
      `SELECT TO_CHAR(month::date,'Mon YYYY') AS period,
              (basic_salary + allowances) AS gross_salary,
              deductions AS tds,
              ROUND(LEAST(basic_salary,15000)*0.12) AS pf_employee,
              CASE WHEN (basic_salary+allowances)>10000 THEN 175 ELSE 0 END AS professional_tax,
              net_salary, present_days
       FROM payrolls
       WHERE employee_id=$1
         AND month::date BETWEEN $2 AND $3
         AND status='Paid'
       ORDER BY month`,
      [emp_id, fyStart, fyEnd]
    );
    months = rows;
  }

  const totGross  = months.reduce((a,r) => a + parseFloat(r.gross_salary||0), 0);
  const totTds    = months.reduce((a,r) => a + parseFloat(r.tds||0), 0);
  const totPf     = months.reduce((a,r) => a + parseFloat(r.pf_employee||0), 0);
  const totPt     = months.reduce((a,r) => a + parseFloat(r.professional_tax||0), 0);
  const totNet    = months.reduce((a,r) => a + parseFloat(r.net_salary||0), 0);
  const fmtMoney  = v => `Rs.${Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
  const fy        = `${parseInt(year)-1}-${year}`;

  // Generate PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Form16_${emp.employee_code||emp_id}_FY${fy}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  const W = 495; // content width

  // Header
  doc.rect(50, 50, W, 40).fill('#1b1b1d');
  doc.fillColor('#fff').fontSize(16).font('Helvetica-Bold')
     .text('FORM 16 — TDS CERTIFICATE (PART A & B)', 60, 62);
  doc.fillColor('#1b1b1d');

  // Employer / Employee strip
  doc.moveDown(1.5).fontSize(10).font('Helvetica-Bold').text('EMPLOYER DETAILS', 50);
  doc.font('Helvetica').fontSize(9)
     .text('Name:  MK PAPER MILL', 50)
     .text('TAN:   MKTANXXXXXXX  (update in .env)', 50)
     .text(`Financial Year:  FY ${fy}`, 50);

  doc.moveDown(0.5).font('Helvetica-Bold').fontSize(10).text('EMPLOYEE DETAILS', 50);
  doc.font('Helvetica').fontSize(9)
     .text(`Name:              ${emp.name}`, 50)
     .text(`Employee Code:     ${emp.employee_code || '—'}`, 50)
     .text(`PAN:               ${emp.pan || 'Not provided'}`, 50)
     .text(`PF Account No:     ${emp.pf_number || '—'}`, 50)
     .text(`Department:        ${emp.dept_name || '—'}`, 50)
     .text(`Designation:       ${emp.designation || '—'}`, 50);

  // Monthly table
  doc.moveDown(1).font('Helvetica-Bold').fontSize(10).text('MONTHLY EARNINGS & DEDUCTIONS', 50);
  doc.moveDown(0.3);

  const COL = [50, 130, 220, 300, 375, 440];
  const HEAD = ['Month','Gross (₹)','TDS (₹)','PF (₹)','PT (₹)','Net (₹)'];

  // Table header
  doc.rect(50, doc.y, W, 16).fill('#e7e6df');
  HEAD.forEach((h, i) => doc.fillColor('#1b1b1d').font('Helvetica-Bold').fontSize(8).text(h, COL[i], doc.y - 14, { width: 70 }));
  doc.moveDown(0.2);

  // Table rows
  months.forEach((m, idx) => {
    if (idx % 2 === 0) doc.rect(50, doc.y, W, 14).fill('#fafafa').stroke('#e7e6df');
    const vals = [m.period, fmtMoney(m.gross_salary), fmtMoney(m.tds), fmtMoney(m.pf_employee), fmtMoney(m.professional_tax), fmtMoney(m.net_salary)];
    const y = doc.y;
    vals.forEach((v, i) => doc.fillColor('#1b1b1d').font('Helvetica').fontSize(8).text(v, COL[i], y + 2, { width: 70 }));
    doc.moveDown(0.6);
  });

  if (!months.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#dc2626')
       .text('No paid payroll records found for this financial year.', 50);
  }

  // Totals
  doc.moveDown(0.5);
  doc.rect(50, doc.y, W, 18).fill('#1b1b1d');
  const ty = doc.y + 4;
  [['Total', ''], [fmtMoney(totGross), ''], [fmtMoney(totTds), ''], [fmtMoney(totPf), ''], [fmtMoney(totPt), ''], [fmtMoney(totNet), '']]
    .forEach(([v], i) => doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text(i===0?'TOTAL':v, COL[i], ty, { width: 70 }));
  [fmtMoney(totGross), fmtMoney(totTds), fmtMoney(totPf), fmtMoney(totPt), fmtMoney(totNet)]
    .forEach((v, i) => doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text(v, COL[i+1], ty, { width: 70 }));
  doc.moveDown(1.5);

  // Summary box
  doc.rect(50, doc.y, W, 80).stroke('#e7e6df');
  const bx = doc.y + 8;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1b1b1d').text('INCOME TAX SUMMARY', 60, bx);
  doc.font('Helvetica').fontSize(9)
     .text(`Gross Salary (FY ${fy}):`,     60, bx+18).text(fmtMoney(totGross),  280, bx+18)
     .text('PF Deducted (Employee 12%):',  60, bx+30).text(fmtMoney(totPf),     280, bx+30)
     .text('Professional Tax:',            60, bx+42).text(fmtMoney(totPt),     280, bx+42)
     .text('TDS (Income Tax) Deducted:',  60, bx+54).text(fmtMoney(totTds),    280, bx+54, { underline: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#16a34a')
     .text('Net Pay Credited:',            60, bx+68).text(fmtMoney(totNet),    280, bx+68);
  doc.moveDown(4);

  // Declaration
  doc.fillColor('#1b1b1d').font('Helvetica').fontSize(8)
     .text('This certificate is issued under Section 203 of the Income-tax Act, 1961 and is valid only when countersigned by the authorised signatory of the employer.', 50, doc.y, { width: W });
  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(9)
     .text('Authorised Signatory', 350)
     .text('(HR / Finance — MK Paper Mill)', 350);
  doc.font('Helvetica').fontSize(8).fillColor('#8a8a90')
     .text(`Generated: ${new Date().toLocaleDateString('en-IN')} | System: MK Paper Mill ERP`, 50);

  doc.end();
}));

// ── APPRAISAL COMPETENCIES ────────────────────────────────────────────────────
router.get('/appraisals/competencies', auth, ar(async (req, res) => {
  const { cycle_id, emp_id } = req.query;
  if (!cycle_id) return res.json({ success: false, message: 'cycle_id required' });
  const targetEmp = emp_id || req.user.emp_id;
  const { rows } = await pool.query(
    `SELECT ac.id, ac.competency, ac.self_rating AS "selfRating",
            ac.manager_rating AS "managerRating", ac.comments,
            ac.created_at AS "createdAt"
     FROM appraisal_competencies ac
     WHERE ac.cycle_id=$1 AND ac.employee_id=$2
     ORDER BY ac.created_at`, [cycle_id, targetEmp]);
  res.json({ success: true, data: rows });
}));

router.post('/appraisals/competencies', auth, requireLevel(3), ar(async (req, res) => {
  const { cycle_id, employee_id, competency } = req.body;
  if (!cycle_id || !employee_id || !competency) return res.json({ success: false, message: 'cycle_id, employee_id, competency required' });
  const { rows } = await pool.query(
    `INSERT INTO appraisal_competencies(cycle_id,employee_id,competency) VALUES($1,$2,$3) RETURNING *`,
    [cycle_id, employee_id, competency]);
  res.json({ success: true, data: rows[0] });
}));

router.put('/appraisals/competencies/:id/self-rate', auth, ar(async (req, res) => {
  const { self_rating, comments } = req.body;
  const empId = req.user.emp_id;
  if (!empId) return res.json({ success: false, message: 'No employee record for this user' });
  const r = parseFloat(self_rating);
  if (isNaN(r) || r < 1 || r > 5) return res.json({ success: false, message: 'Rating must be 1.0–5.0' });
  const { rowCount } = await pool.query(
    `UPDATE appraisal_competencies SET self_rating=$1, comments=COALESCE($2,comments)
     WHERE id=$3 AND employee_id=$4`,
    [r, comments || null, req.params.id, empId]);
  if (!rowCount) return res.json({ success: false, message: 'Not found or not your competency' });
  res.json({ success: true });
}));

router.put('/appraisals/competencies/:id/manager-rate', auth, requireLevel(3), ar(async (req, res) => {
  const { manager_rating, comments } = req.body;
  const r = parseFloat(manager_rating);
  if (isNaN(r) || r < 1 || r > 5) return res.json({ success: false, message: 'Rating must be 1.0–5.0' });
  const { rowCount } = await pool.query(
    `UPDATE appraisal_competencies SET manager_rating=$1, comments=COALESCE($2,comments) WHERE id=$3`,
    [r, comments || null, req.params.id]);
  if (!rowCount) return res.json({ success: false, message: 'Not found' });
  res.json({ success: true });
}));

// ── HOLIDAY CALENDAR ──────────────────────────────────────────────────────────
router.get('/holidays', auth, ar(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const { rows } = await pool.query(
    `SELECT id, holiday_date AS "date", name, holiday_type AS "type", is_active AS "isActive"
     FROM holidays WHERE year=$1 ORDER BY holiday_date`, [year]);
  res.json({ success: true, data: rows });
}));

router.post('/holidays', auth, requireLevel(3), ar(async (req, res) => {
  const { holiday_date, name, holiday_type } = req.body;
  if (!holiday_date || !name) return res.json({ success: false, message: 'date and name required' });
  const year = new Date(holiday_date).getFullYear();
  const { rows } = await pool.query(
    `INSERT INTO holidays(holiday_date,name,holiday_type,year) VALUES($1,$2,$3,$4) RETURNING *`,
    [holiday_date, name, holiday_type || 'National', year]);
  res.json({ success: true, data: rows[0] });
}));

router.put('/holidays/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { name, holiday_type, is_active } = req.body;
  await pool.query(
    `UPDATE holidays SET name=COALESCE($1,name), holiday_type=COALESCE($2,holiday_type),
     is_active=COALESCE($3,is_active) WHERE id=$4`,
    [name || null, holiday_type || null, is_active ?? null, req.params.id]);
  res.json({ success: true });
}));

router.delete('/holidays/:id', auth, requireLevel(4), ar(async (req, res) => {
  await pool.query(`DELETE FROM holidays WHERE id=$1`, [req.params.id]);
  res.json({ success: true });
}));

// ── EMPLOYEE LOANS & ADVANCES ─────────────────────────────────────────────────
router.get('/loans', auth, ar(async (req, res) => {
  const lvl = req.user.role_level;
  const isHRAdmin = req.user.dept_code === 'HR' && lvl >= 3;
  let query, params;
  if (isHRAdmin || lvl >= 4) {
    const emp_id = req.query.emp_id;
    if (emp_id) {
      query = `SELECT el.*, e.name AS "empName", e.employee_code AS "empCode"
               FROM employee_loans el JOIN employees e ON e.id=el.employee_id
               WHERE el.employee_id=$1 ORDER BY el.created_at DESC`;
      params = [emp_id];
    } else {
      query = `SELECT el.*, e.name AS "empName", e.employee_code AS "empCode"
               FROM employee_loans el JOIN employees e ON e.id=el.employee_id
               ORDER BY el.created_at DESC LIMIT 200`;
      params = [];
    }
  } else {
    const empId = req.user.emp_id;
    if (!empId) return res.json({ success: true, data: [] });
    query = `SELECT el.*, e.name AS "empName", e.employee_code AS "empCode"
             FROM employee_loans el JOIN employees e ON e.id=el.employee_id
             WHERE el.employee_id=$1 ORDER BY el.created_at DESC`;
    params = [empId];
  }
  const { rows } = await pool.query(query, params);
  res.json({ success: true, data: rows });
}));

router.post('/loans', auth, requireLevel(3), ar(async (req, res) => {
  const { employee_id, loan_type, amount, disbursed_date, monthly_emi, notes } = req.body;
  if (!employee_id || !amount || !disbursed_date) return res.json({ success: false, message: 'employee_id, amount, disbursed_date required' });
  const { rows } = await pool.query(
    `INSERT INTO employee_loans(employee_id,loan_type,amount,disbursed_date,monthly_emi,outstanding,notes,approved_by)
     VALUES($1,$2,$3,$4,$5,$3,$6,$7) RETURNING *`,
    [employee_id, loan_type || 'advance', parseFloat(amount), disbursed_date,
     parseFloat(monthly_emi || 0), notes || null, req.user.id]);
  res.json({ success: true, data: rows[0] });
}));

router.put('/loans/:id/pay', auth, requireLevel(3), ar(async (req, res) => {
  const { payment_amount } = req.body;
  const amt = parseFloat(payment_amount);
  if (!amt || amt <= 0) return res.json({ success: false, message: 'payment_amount required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT outstanding FROM employee_loans WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.json({ success: false, message: 'Loan not found' }); }
    const newOutstanding = Math.max(0, parseFloat(rows[0].outstanding) - amt);
    const newStatus = newOutstanding === 0 ? 'closed' : 'active';
    await client.query(`UPDATE employee_loans SET outstanding=$1, status=$2 WHERE id=$3`,
      [newOutstanding, newStatus, req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true, outstanding: newOutstanding, status: newStatus });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

router.put('/loans/:id', auth, requireLevel(3), ar(async (req, res) => {
  const { status, notes, monthly_emi } = req.body;
  await pool.query(
    `UPDATE employee_loans SET status=COALESCE($1,status), notes=COALESCE($2,notes),
     monthly_emi=COALESCE($3,monthly_emi) WHERE id=$4`,
    [status || null, notes || null, monthly_emi ? parseFloat(monthly_emi) : null, req.params.id]);
  res.json({ success: true });
}));

// ─── UTILITY: compute salary breakdown from structure + basic ────────────────
// Used internally by payroll engine (Ph16-F)
function computeSalaryBreakdown(basic, structure) {
  const b = parseFloat(basic || 0);
  const s = structure || { basic_pct: 100, hra_pct: 40, da_pct: 20, conv_fixed: 1600, medical_fixed: 1250, special_pct: 0 };
  const basicEarning = b;
  const hra          = Math.round(basicEarning * (parseFloat(s.hra_pct) / 100));
  const da           = Math.round(basicEarning * (parseFloat(s.da_pct)  / 100));
  const conv         = parseFloat(s.conv_fixed     || 0);
  const medical      = parseFloat(s.medical_fixed  || 0);
  const special      = Math.round(basicEarning * (parseFloat(s.special_pct) / 100));
  const gross        = basicEarning + hra + da + conv + medical + special;
  const pfEmp        = Math.round(Math.min(basicEarning, 15000) * 0.12);
  const pfEmployer   = pfEmp;
  const esicEmp      = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
  const esicEmployer = gross <= 21000 ? Math.round(gross * 0.0325) : 0;
  const pt           = gross > 10000 ? (gross > 7500 ? 175 : 0) : 0;
  const totalDeductions = pfEmp + esicEmp + pt;
  const net          = gross - totalDeductions;
  return { basic: basicEarning, hra, da, conveyance: conv, medical, special_allowance: special,
           gross, pf_employee: pfEmp, pf_employer: pfEmployer,
           esic_employee: esicEmp, esic_employer: esicEmployer,
           professional_tax: pt, total_deductions: totalDeductions, net };
}
router._computeSalaryBreakdown = computeSalaryBreakdown; // expose for Ph16-F payroll engine

module.exports = router;

