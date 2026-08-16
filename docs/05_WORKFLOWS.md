# MK Paper Mill ERP — Core Workflows

> End-to-end process flows that cross module boundaries.
> Read this to understand the lifecycle of major business objects before adding features.

---

## 1. Production Reel Lifecycle

```
[Production]       [Quality]         [FG Warehouse]    [Dispatch]
    |                   |                   |               |
    v                   |                   |               |
Operator starts    After reel          Reel moved to    Sales Order
shift & logs       completion:         warehouse:       triggers:
    |              QC Test created         |               |
    v                   |                   v               v
Reel record        Test params         rack_location   Dispatch Order
created            recorded            updated         created
(status=           (result=Pending)        |               |
 In Production)         |                  |           reel.status =
    |                   v                  |            Dispatched
    v              L3+ Approves:           |
reel completed:    Pass -> reel.         [Sales]
status=            quality_status=      fulfilled_mt
"QC Pending"       Approved +           updated
                   status="In
                   Warehouse"
                        |
                   Fail -> reel.
                   quality_status=
                   Rejected
```

**Key status values for `reels.status`:**
`In Production` -> `QC Pending` -> `QC Done` -> `In Warehouse` -> `Dispatched` | `Rejected`

---

## 2. Indent / PIIMAS Workflow

```
[Any Department]        [Store Manager]      [Purchase]       [Dept that raised]
       |                      |                   |                  |
       v                      |                   |                  |
Raise Indent           L1: Shift Supervisor   L3 Approved ->        |
(status=Draft)         approves               PO Created            |
       |               (status=L1 Approved)        |                |
       v                      |                    v                 |
Submit Indent          L2: Manager approves   GRN received ->        |
(status=Submitted)     (status=L2 Approved)   Stock updated          |
       |                      |                    |                 |
       v                      |                    v                 |
PIIMAS Escalation      L3: Plant Head         Store issues      Dept acks
cron checks:           approves               to dept           receipt
>24h pending ack       (status=L3 Approved)   (requireStore)    (ack_status=
-> notify dept head         |                       |            confirmed)
>48h -> auto-escalate       v                       |
                       Or: Reject at any       store_indent_log
                       level                   written in same
                       (status=Rejected)       transaction
```

**Critical rule:** `requireStore` middleware + `store_indent_log` write in same transaction are MANDATORY on all issue routes.

---

## 3. Purchase Order Flow

```
Indent L3 Approved
       |
       v
Purchase creates PO
(status=Draft)
       |
       v
L4+ Approves PO
(status=Approved)
       |
       v
PO Sent to Vendor
(status=Sent)
       |
       v
Vendor delivers ->
GRN created
(status=Received)
       |
       v
QC team checks
GRN items:
  Pass -> accepted_qty
  Fail -> rejected_qty
       |
       v
Inventory updated:
stock_ledger INSERT
materials.current_stock
updated
```

---

## 4. HR / Payroll Monthly Cycle

```
Daily:
  Attendance marked per employee
  (status: Present/Absent/Half Day/Leave/Holiday/OT)
       |
       v
Monthly:
  HR Admin generates payroll
  - Pulls attendance for month
  - Calculates basic + allowances - deductions
  - PF / ESIC computed
  - Leave deductions applied
       |
       v
Plant Head approves payroll
       |
       v
Payslips generated (PDF)
Bank transfer initiated
       |
       v
Finance records payment
```

---

## 5. User Login Flow

```
Browser                     Backend                      DB
   |                           |                          |
   |-- POST /api/auth/login --> |                          |
   |  { email, password }      |-- SELECT user+role+dept ->|
   |                           |<- user row ----------------|
   |                           |-- bcrypt.compare()         |
   |                           |-- UPDATE last_login -----> |
   |                           |-- SELECT employee record -> |
   |                           |-- jwt.sign({ userId })     |
   |<-- { token, user } -------|                            |
   |                           |                            |
   | localStorage.setItem(     |                            |
   |   'mk_token', token)      |                            |
   |                           |                            |
   | All subsequent requests:  |                            |
   |-- GET /api/... ---------->|                            |
   |  Authorization: Bearer.. |-- jwt.verify() -----------|
   |                           |-- SELECT user+role+dept -> |
   |                           |-- req.user = {...}         |
   |<-- { success, data } -----|                            |
```

**Force password change gate:**
- If `must_change_password=true`, ALL requests blocked except allowlisted paths
- Frontend shows `ForceChangePassword` component

---

## 6. Notification & Escalation Flow

```
Event occurs                PIIMAS Cron (every 2h)
(e.g., indent issued)            |
       |                         v
       v               Find indents where:
notifications table:     - status = 'Issued'
INSERT for relevant      - ack pending > 24h
users                          |
(type=info/warning)            v
       |               For each overdue:
       v               - Find dept_head (role_level>=3)
Frontend polls           - INSERT notification
every 60s:               - Check if notified in last 24h
GET /api/hr/             - Skip if already notified
notifications                  |
       |                       v
Bell icon shows        If > 48h overdue:
unread count           - Append [Auto-escalated] to
                         indent.remarks
```

---

## 7. Quality Test Flow

```
Trigger:
  - Incoming: GRN received -> QC test created
  - Process: Operator flags reel -> QC test
  - Final: Reel complete -> QC test

       |
       v
Lab technician records params:
  GSM, moisture, caliper, burst factor,
  cobb value, brightness, tensile/tear strength

       |
       v
L3+ Quality Manager approves:
  Pass -> reel.quality_status = 'Approved'
          reel.status = 'In Warehouse'
  Fail -> reel.quality_status = 'Rejected'
          reel.status = 'Rejected'
  Hold -> reel.quality_status = 'Hold'
          Pending re-test
```

---

## 8. Utility Monitoring Flow

```
Every shift (manual entry):
  Utility operator records:
  - Power units consumed (grid + DG)
  - Steam generated / coal consumed
  - Boiler pressure & temp
  - Fresh + process water consumed
  - Compressed air pressure
  - ETP inlet/outlet readings

Hourly (automated KPI cron):
  section_process_readings
  aggregated -> section_kpi_snapshots
  (AVG per tag_name per section per hour)
```

---

## 9. Goods Receipt to Stock Update Flow

```
PO Sent -> Vendor Delivers
       |
       v
Store/Inventory creates GRN
(status=Draft)
       |
       v
Items received and counted
(received_qty per item)
       |
       v
QC Inspection:
  accepted_qty / rejected_qty set
  GRN status -> QC Done
       |
       v
L3+ Approves GRN
(status=Approved)
       |
       v
Stock updated:
  stock_ledger INSERT (type=GRN, in_qty=accepted_qty)
  materials.current_stock += accepted_qty
```

---

## 10. Report Generation Flow

```
User requests report (date range, module)
       |
       v
Backend queries relevant tables
(reels, production_summary, stock_ledger, etc.)
       |
       v
Aggregation in SQL
(SUM, AVG, GROUP BY date/shift/machine)
       |
       v
Response as JSON
       |
       v
Frontend renders table/chart
OR pdfkit generates downloadable PDF
OR xlsx generates Excel download
```

---

*Last updated: 2026-07-17 | See 04_API_CONTRACTS for endpoint details*
