# HR & Payroll Module — Full Workflow & Rules

## Overview
Employee lifecycle management: creation, attendance, leave, loans, holidays, payroll, 
payslip generation, PF/ESIC tracking, document uploads, and notifications.
Largest route file: 2133 lines (96KB). Largest page: HR.jsx (116KB).

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/hr.js` | All HR endpoints (2133 lines — 96KB) |
| `frontend/src/pages/HR.jsx` | HR management UI (116KB — most complex page) |
| Uploads: `backend/uploads/hr/` | Employee documents (PDF, DOCX, JPG, PNG, XLSX, CSV) |

## Database Tables
| Table | Purpose |
|---|---|
| `employees` | Employee master |
| `attendance` | Daily attendance records |
| `payroll` | Monthly payroll records |
| `payroll_items` | Payroll line items (earnings/deductions) |
| `leaves` | Leave applications |
| `leave_balances` | Leave balance per employee per type |
| `holidays` | Company holiday calendar |
| `employee_loans` | Salary advance/loans |
| `loan_repayments` | Loan EMI deduction records |
| `hr_documents` | Uploaded document metadata |
| `notifications` | Shared notification table |

## Special Auth: is_hr_admin
Set in auth middleware:
- Condition: `user.dept_code === 'HR' && user.role_level >= 3`
- Effect: Full HR admin access regardless of department
- Check: `req.user.is_hr_admin`

Access tiers for employee data:
- L1 (own record only)
- L2/L3 (own dept employees)
- L4+ / is_hr_admin (all employees org-wide)

## PII Masking
Sensitive fields are masked for anyone below L4 / non-HR:
- `aadhar`: shows only last 4 digits (`****1234`)
- `pan`: shows only last 4 digits
- `bank_account`: shows only last 4 digits
- `basic_salary`: hidden entirely for non-self access below L4

## File Upload Config
- Directory: `backend/uploads/hr/`
- Max size: 10MB
- Allowed: pdf, doc, docx, jpg, jpeg, png, xlsx, csv
- Endpoint: `POST /hr/upload` (L2+)
- Response: `{ url: '/uploads/hr/{filename}', originalName, sizeKb }`

## API Endpoints

### Employees
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hr/employees` | L1+ | List employees (filter: dept, search, is_active, page, limit) |
| GET | `/hr/employees/me` | L1+ | Own employee record (linked via user_id or employee_code) |
| GET | `/hr/employees/:id` | L1+tiered | Single employee (PII masked below L4) |
| POST | `/hr/employees` | L3+ | Create employee |
| PUT | `/hr/employees/:id` | L3+ | Update employee |
| DELETE | `/hr/employees/:id` | L4+ | Soft-delete (is_active=false) |

### Attendance
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hr/attendance` | L1+ | Attendance records (filter: emp, date, month) |
| POST | `/hr/attendance` | L2+ | Mark attendance (bulk or single) |
| PUT | `/hr/attendance/:id` | is_hr_admin | Correct attendance |
| GET | `/hr/attendance/summary` | L2+ | Monthly summary per employee |

### Leave
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hr/leaves` | L1+ | Leave applications (filter: status, emp, type) |
| POST | `/hr/leaves` | L1+ | Apply for leave |
| PUT | `/hr/leaves/:id/approve` | L3+ (HOD) or is_hr_admin | Approve leave |
| PUT | `/hr/leaves/:id/reject` | L3+ (HOD) or is_hr_admin | Reject leave |
| GET | `/hr/leave-balances` | L1+ | Leave balances per employee |

### Payroll
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hr/payroll` | is_hr_admin or L4+ | List payroll records (month/year filter) |
| POST | `/hr/payroll/generate` | is_hr_admin | Generate payroll for month/year |
| PUT | `/hr/payroll/:id/approve` | L4+ (Plant Head) | Approve payroll |
| GET | `/hr/payroll/:id/payslip` | is_hr_admin | Generate PDF payslip (pdfkit) |
| GET | `/hr/payroll/me/:month/:year` | L1+ | Own payslip |

### Holidays
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hr/holidays` | L1+ | Holiday calendar |
| POST | `/hr/holidays` | is_hr_admin | Add holiday |
| DELETE | `/hr/holidays/:id` | is_hr_admin | Remove holiday |

### Loans
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hr/loans` | is_hr_admin or L4+ | All loans |
| GET | `/hr/loans/me` | L1+ | Own loans |
| POST | `/hr/loans` | is_hr_admin | Create loan |
| POST | `/hr/loans/:id/repayment` | is_hr_admin | Record repayment |

### Documents
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/hr/upload` | L2+ | Upload document |
| POST | `/hr/documents` | L3+ | Link uploaded doc to employee |
| GET | `/hr/documents/:empId` | L2+ tiered | Employee document list |
| DELETE | `/hr/documents/:id` | is_hr_admin | Delete document record |

### Notifications
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/hr/notifications` | L1+ | HR notifications for logged-in user |
| PUT | `/hr/notifications/:id/read` | L1+ | Mark notification as read |

## Payroll Calculation Logic
When generating payroll for month/year:
1. Count working days from `attendance` (Present / Half Day / OT)
2. Count holidays from `holidays` table
3. Leave Without Pay: counted from `leaves` (type='LWP', status='Approved')
4. Calculated fields:
   - `gross = basic_salary × (worked_days / total_days)`
   - `pf_deduction = 12% of basic`
   - `esic_deduction = 0.75% of gross`
   - `loan_deduction = active EMI repayment from employee_loans`
   - `net = gross - pf - esic - loan_deductions`
5. `payroll_items` rows inserted for each earning/deduction type

## Leave Types
| Code | Type | Default Balance |
|---|---|---|
| EL | Earned Leave | 15 days/year |
| SL | Sick Leave | 10 days/year |
| CL | Casual Leave | 10 days/year |
| CO | Comp Off | As earned |
| LWP | Leave Without Pay | Unlimited (deducted from salary) |

## Attendance Status Values
| Status | Description |
|---|---|
| Present | Full day worked |
| Absent | Not present |
| Half Day | Half shift worked |
| Leave | On approved leave |
| Holiday | Company holiday |
| OT | Overtime (present + extra) |

## Employee Fields
| Field | Description |
|---|---|
| `employee_code` | Unique employee ID (EMP-001 format) |
| `name` | Full name |
| `department_id` | FK → departments |
| `designation` | Job title |
| `doj` | Date of joining |
| `dob` | Date of birth |
| `gender` | M/F/Other |
| `mobile` | Phone number |
| `email` | Work email |
| `aadhar` | Aadhar number (masked below L4) |
| `pan` | PAN number (masked below L4) |
| `pf_number` | PF account number |
| `esic_number` | ESIC account number |
| `bank_account` | Bank account number (masked below L4) |
| `bank_name` | Bank name |
| `ifsc` | IFSC code |
| `basic_salary` | Monthly basic salary |
| `user_id` | Linked system user account |
| `is_dept_head` | Whether employee is HOD |
| `is_active` | Active/deactivated flag |

## PDF Payslip Generation
- Library: `pdfkit` (require('pdfkit'))
- Streamed directly: `res.setHeader('Content-Type', 'application/pdf')`
- Content: employee info, month, earnings table, deductions table, net pay
- File not saved to disk — generated on-the-fly per request

## Notification Polling
- App.jsx polls `GET /api/hr/notifications` every 60 seconds
- Unread count shown in navbar
- Notification types: leave_approved, leave_rejected, payroll_ready, HR announcements

## Rules
1. Employee creation: L3+ (HR Manager or Plant Head)
2. Payroll generation: is_hr_admin only
3. Payroll approval: L4+ (Plant Head) — separate from HR admin
4. Attendance correction: is_hr_admin only (strong control)
5. Leave approval: HOD (L3+ same dept) or is_hr_admin
6. Salary visible to own record (any level), or L4+ / is_hr_admin for others
7. Soft-delete employees: set `is_active=false` — never DELETE rows
8. `user_id` linkage: when employee has user_id, they can see own records via `/me`
9. PF mandatory for permanent employees; ESIC for salary < ₹21,000/month
10. Document upload: HR creates physical record, then calls /documents to link to employee

## Common Query Patterns
```sql
-- Monthly attendance summary
SELECT e.name, e.employee_code,
  COUNT(*) FILTER (WHERE a.status='Present') AS present,
  COUNT(*) FILTER (WHERE a.status='Absent') AS absent,
  COUNT(*) FILTER (WHERE a.status='Leave') AS leaves
FROM attendance a
JOIN employees e ON e.id = a.employee_id
WHERE DATE_TRUNC('month', a.date) = DATE_TRUNC('month', $1::date)
  AND e.department_id = $2
GROUP BY e.id, e.name, e.employee_code;

-- Payroll summary for month
SELECT SUM(gross_salary) AS total_gross, SUM(net_salary) AS total_net,
       SUM(pf_deduction) AS total_pf, SUM(esic_deduction) AS total_esic
FROM payroll WHERE month = $1 AND year = $2 AND status = 'Approved';
```
