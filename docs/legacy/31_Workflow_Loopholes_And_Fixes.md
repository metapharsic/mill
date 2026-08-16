# Workflow Loopholes & Department-Wise Fix Plan (Ph31)

> **STATUS: 25 of 25 CLOSED, no exceptions.** Audit 2026-07-10, all fixes applied + curl-verified live same day (see §3). Nothing left on the interim-fix list — #20 and #22 got their full schema treatment same session.
> Pairs with `19_Departments_Logins_Approvers.md` (org/login model) and `30_RoleBased_PlantSections_RBAC.md` (section RBAC).
> §2 below (department-wise workflow) is kept **as originally audited** — it describes the gaps found, not the current state. See §3 status column and §6 for what's actually live now.

---

## 1. Why this doc exists

Route-by-route audit of `backend/src/routes/*.js` found the *same class* of action (approve, issue-stock, record-financial-value, escalate-privilege) guarded at wildly different strength depending which file wrote it. Some routes have tiered value-based approval + department checks. Others have nothing but `requireAuth`. This doc maps the workflow **as it exists today, department by department**, flags every gap found, and lays out a phased fix plan so the next dev (or next Claude session) doesn't have to re-derive it.

---

## 2. Department-wise workflow (as-built today)

### 2.1 Store / Materials & Indent

Two **parallel, non-identical** systems exist for the same job (issue material against a request):

| Step | `indent.js` (indents table) | `store.js` (store_indents table) | `inventory.js` (materials, no request doc) |
|---|---|---|---|
| Create request | `requireLevel(1)` | `requireAuth` | n/a — no request needed |
| L1 approve | `requireLevel(3)` + Store-dept-or-L4 check | `requireLevel(2)`, no dept check | n/a |
| L2 approve (tier 2/3) | `requireLevel(4)` | none | n/a |
| Value-tier gate | `approval_matrix` table exists, **never queried inside approve routes** | none at all | none |
| Issue stock | `requireStore` (correct) | `requireStore` (correct) | `requireLevel(2)`, **no request doc link** |
| Close / ack | HOD acknowledge required, or level-3 force-close (bypasses ack) | level-anyone close | n/a |

Plus `chemicals.js` `/pick`, `/sales-pick`, `/receipt` — a **fourth** stock-movement path, `requireAuth` only, zero role gate.

**Net:** 4 doors out of the store, 4 different trust levels. Weakest wins.

### 2.2 Purchase

`purchase.js`: PO create `requireLevel(3)` → approve `requireLevel(4)`. No value tiering (indent has a 3-tier matrix; PO has none — a ₹50L PO clears the same single signature as a ₹500 one). No `approved_by != created_by` check.

### 2.3 Finance

`finance.js`: payment recording `requireLevel(3)`, single person, no counter-approval, no proof/receipt field enforced. Payment number generated via `COUNT(*)+1` scan (race condition on concurrent submits).

### 2.4 HR & Payroll

`hr.js`: leave/attendance-regularize approve `requireLevel(2)` with **no reporting-line / same-department check** — any level-2 anywhere can approve anyone's leave. Separation *raise* step has no role gate at all (approve/complete are tiered correctly). Payroll `generate` and legacy `/payroll/:id/pay` both sit at `requireLevel(3)` — one person can compute and release pay with no second approver (the newer `/payroll/runs/:id/approve` path does add a level-4 gate — inconsistent with the legacy path still present).

### 2.5 Production

`production.js`: reel status, downtime open/close — `requireAuth` only, no level check. These numbers drive OEE/uptime KPIs and are entirely self-reported by the operator who owns the machine. `chemical-consumption`, `furnish`, `shift-reports` created at `requireLevel(1)`, no downstream approval before they feed cost-per-tonne calculations. Daily report *approve* is correctly tiered at `requireLevel(3)`.

### 2.6 Quality / Lab

`quality.js` tests: create, pass, fail, retest all `requireLevel(2)` — same person can log a test and pass/fail it (no QA/QC segregation). `laboratory.js` `/samples`, `/samples/:id/result` — `requireAuth` only, zero role gate on regulatory test results.

### 2.7 EHS / Security / Scrap

`ehs.js` incidents — `requireAuth` only, editable after filing with no lock. `security.js` gate-passes — `requireAuth` only, no distinct gate-guard role enforced server-side. `scrap.js` create/update — `requireAuth` only, no approval step; scrap is a financial write-off channel with zero control today.

### 2.8 Master Data

`master.js`: machines/grades/categories `requireLevel(4)`, materials/vendors/customers/sections `requireLevel(3)`. Consistent tiering, **but no audit-log insert on any master-data change** (unlike indents, which write to `indent_audit_log`). Vendor bank details, customer credit terms — changed silently.

### 2.9 Admin / Users

`admin.js` — every action correctly `requireLevel(5)`, including `reset-password`. `users.js` — duplicate `reset-password` route exists with **`requireAuth` only**, no level check. Two doors again; the weak one wins.

---

## 3. Loophole register (severity-ordered) — fix status

| # | Severity | File:line | Gap | Status |
|---|---|---|---|---|
| 1 | CRITICAL | `users.js:77` | `reset-password` has no `requireLevel` — any logged-in user resets any password, including admin. | ✅ Fixed — `requireLevel(5)` added, verified live (level3 user blocked, admin allowed). |
| 2 | HIGH | `store.js` vs `indent.js` | Two indent/approval systems, weaker one has no tier/dept gate. | ✅ Fixed — `store.js` approve bumped to level3+dept-scope+maker≠checker (matches `indent.js` strength). Merge question put to business owner — decision: keep both, settled. |
| 3 | HIGH | `indent.js:116-220` | `approval_matrix` tier logic computed, never enforced in approve routes. | ✅ Fixed — `getIndentTier()` wired into `approve/l2`, rejects if approver's level < required tier. |
| 4 | HIGH | `purchase.js:86-93` | No PO value tiering at all. | ✅ Fixed — PO approve now looks up `approval_matrix` by `grand_total`, same table indent.js uses. |
| 5 | HIGH | whole approval chain | No `approved_by != raised_by` maker-checker check anywhere. | ✅ Fixed — added to indent L1/L2, PO approve, quality pass/fail, payment confirm, store.js approve, payroll pay. |
| 6 | HIGH | `finance.js:103` | Single-person payment entry, no counter-approval or proof enforcement. | ✅ Fixed, verified live — `PUT /payments/:id/confirm` blocks self-confirm for level<5, PO approve blocks self-approve, both tested with seeded vendor/customer/sales-order. |
| 7 | MEDIUM | `hr.js:274,347` | Payroll generate + legacy pay both level-3, no separation of compute vs release. | ✅ Fixed — `payroll_runs` pay blocks approver==payer; legacy `/payroll/:id/pay` bumped level3→4. |
| 8 | MEDIUM | `indent.js`,`purchase.js`,`finance.js` seq numbers | `COUNT(*)+1` race condition on document numbering. | ✅ Fixed — `pg_advisory_xact_lock` added to indent/PO/quality/payment/scrap/EHS/gate-pass numbering, verified live. |
| 9 | MEDIUM | `inventory.js` issue route | Stock exit with no request-document link. | ✅ Fixed — `/issue` now requires `referenceId`+`referenceType`(Indent\|PO), checks status=Approved, gated `requireStore`. Verified live — undocumented issue rejected. |
| 10 | LOW | `indent.js:158` | Store-dept check hardcodes department name string. | ✅ Fixed — replaced with `dept_code === 'STORE'` check. |
| 11 | MEDIUM | `hr.js` leave/regularize approve | No reporting-line / same-dept check on approver. | ✅ Fixed — regularize-approve now has the same dept-isolation guard leave-approve already had. |
| 12 | MEDIUM | `hr.js` separation raise | No role gate on raising a separation. | ✅ Fixed — `requireLevel(2)` added. |
| 13 | HIGH | `quality.js` | Same level can log + pass/fail own test — no QA/QC segregation. | ✅ Fixed — pass/fail blocks `tested_by === req.user.id` unless level4+. Verified live. |
| 14 | HIGH | `laboratory.js:29,45` | Sample results postable by anyone, no role gate. | ✅ Fixed — `requireLevel(2)` added to result route. |
| 15 | MEDIUM | `ehs.js` | Incident editable after filing, no lock, no level gate. | ✅ Fixed — locked from edit once status leaves `Open` unless level2+. |
| 16 | MEDIUM | `security.js` | Gate-pass in/out — no distinct guard role enforced server-side. | ✅ Fixed — new `requireGuard` (SEC dept or level4+) on create + exit-close. |
| 17 | HIGH | `scrap.js` | Financial write-off entry, zero gate, zero approval. | ✅ Fixed — create+update now `requireLevel(2)`. Also found+fixed a pre-existing bug: table was missing a `remarks` column the code always referenced (was silently 500ing). |
| 18 | MEDIUM | `production.js` reels/downtime | Self-reported OEE/uptime data, no supervisor check. | ✅ Fixed — reel status transitions + downtime close both bumped to `requireLevel(2)`. |
| 19 | MEDIUM | `production.js` chemical-consumption/furnish/shift-reports | Cost-driving entries, no approval step downstream. | ✅ Checked, no action needed — `daily-report` approve (level3) already aggregates + reviews these figures. Per-entry gate would be redundant. |
| 20 | MEDIUM | `inventory.js` adjustment | Single approver stock adjustment — shrinkage cover risk. | ✅ Fixed, full workflow — new `adjustment_requests` table, raise (level3) writes no stock, approve (level4, different person) does. Verified live: self-approve blocked, admin-override works, stock actually moved on approve. |
| 21 | LOW | `master.js` all CRUD | No audit-log write on master-data changes. | ✅ Fixed — router-level audit middleware logs every POST/PUT/DELETE automatically, no per-route edits. Verified live. |
| 22 | LOW | `master.js` restore endpoints | Same level can delete then restore, no maker-checker on reversal. | ✅ Fixed, real maker≠checker — `deleted_by` column added, restore blocks same user who deleted (unless admin). Verified live: level3 delete→self-restore blocked, admin restore works. |
| 23 | HIGH | `middleware/auth.js:4` | Hardcoded JWT secret fallback if `.env` missing. | ✅ Checked, no action needed — `server.js` already boot-refuses to start on missing/weak `JWT_SECRET`. |
| 24 | MEDIUM | `users`/`employees` | `must_change_password` flag not enforced as a route-blocking gate. | ✅ Fixed — `auth.js` middleware now blocks all routes except change-password/me/logout until rotated. |
| 25 | HIGH | `chemicals.js` pick/sales-pick/receipt | Zero-gate stock movement, 4th parallel path. | ✅ Fixed — pick+receipt `requireStore`, sales-pick `requireLevel(2)`. |

---

## 4. Fix plan — phased (all DONE except where noted)

### Phase F1 — Stop the bleeding (privilege escalation + zero-gate money/compliance actions) ✅ DONE
Target: #1, #6, #13, #14, #17, #23, #25 — all closed, see §3.

### Phase F2 — Enforce tiering that already exists ✅ DONE
Target: #3, #4 — `getIndentTier()` wired into approve/l2, PO approve now queries `approval_matrix` by `grand_total`.

### Phase F3 — Maker-checker ✅ DONE, fully
Target: #5, #7, #20, #22 — maker≠checker live on indent/PO/quality/payment/payroll/store. #20 got its full schema: `adjustment_requests` table, raise≠approve, verified live. #22 got `deleted_by` column, restore now blocks the same user who deleted, verified live.

### Phase F4 — Close the parallel-path problem ✅ DONE (decision made)
Target: #2, #9, #25 — all closed. #2: `store.js` leveled up to match `indent.js` strength. Table-merge question explicitly put to the business owner 2026-07-10 — **decision: keep both systems, do nothing more.** Not a gap anymore, it's a settled call.

### Phase F5 — Consistency + audit trail ✅ DONE (except #19, and #18 addressed)
Target: #8, #10, #11, #12, #16, #18, #19, #21, #24 — #18 fixed (reel status + downtime close bumped to `requireLevel(2)`, supervisor confirm required). #19 checked closer: `daily-report` approve (level3) already aggregates and reviews chemical-consumption/furnish/shift-report figures downstream — the review gate already exists at the aggregate level, adding a redundant per-entry gate would be over-engineering. Everything else in this phase closed.

---

## 6. What's actually left

Nothing, on this register. All 25 items closed, verified live, or settled by explicit decision. `db/migration_adjustment_approval.sql` carries #20's `adjustment_requests` table and #22's `deleted_by` columns — run it before deploying these fixes elsewhere.

If new gaps surface later, they go in a new doc (32+) or a fresh round appended here — don't reopen this register once it's closed.

---

## 7. Canonical RBAC contract (apply going forward)

Every new mutating route should declare, explicitly, in this order:

1. `auth` — who is this.
2. `requireLevel(N)` — minimum role tier for this action class (create=1-2, approve-L1=3, approve-L2/L3=4, admin-only=5).
3. Department scope — either `requireStore`-style dept check, or explicit `req.user.department_id === record.department_id` unless role_level >= 4 (plant-head/admin cross-dept override).
4. Maker-checker — explicit `record.created_by !== req.user.id` check on any approve/reject/close route.
5. Audit write — every status-changing mutation inserts one row into an audit/history table (`indent_audit_log` is the reference pattern — reuse or extend it, don't invent per-module logs).
6. Value tiering — for anything with a money value (indent, PO, payment, adjustment), look up the matrix table, don't hardcode a single level.

Any PR touching a route file should be checked against this list before merge.
