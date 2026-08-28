# 🎭 MK Paper Mill ERP — Master Playwright Testing & Architecture Guide

> **Standard Operating Procedure:** This guide establishes the end-to-end testing standards, architectural decisions, and page object model patterns based on the UK Hydrographic Office (UKHO) Playwright standards.

---

## 🏛️ 1. Architecture & System Topology

```
Browser (React 18 SPA + Vite)
    Port: 3333 (dev) / served from dist/ (prod)
          │
          │  REST API (Bearer JWT, localStorage: 'mk_token')
          ▼
Node.js + Express API Server (Port 5000)
    Middleware: auth -> requireLevel(n) -> requireStore -> JSON error handler
          │
          │  pg Pool (singleton)
          ▼
PostgreSQL Database (mk_paper_mill:5432)
```

---

## ⚖️ 2. Core Architectural Decisions & Quality Rules

1. **Multi-tier Approvals & Role Hierarchy:**
   - **Level 1 (Operator/User):** Can draft & submit Indents/POs.
   - **Level 2 (Supervisor):** Can execute L1 Approvals.
   - **Level 3 (Store Manager / Manager):** Can execute L2 Approvals & Store Gate Passes.
   - **Level 4/5 (Plant Head / Admin / Director):** Full override bypass across all approval matrices.
   - **Maker != Checker:** Requesters cannot approve their own Indents/POs unless Admin override applies.
2. **Atomic Stock Ledger Integrity:**
   - All inward/outward DML (`GRN`, `Issue`, `Return`, `Adjustment`) atomically adjusts `materials.current_stock` and appends to `stock_ledger`.
   - `requireStore` guard enforced on all stock-deduction routes.
3. **Rollback & State Reconciliation:**
   - Deleting or cancelling a Purchase Order atomically rolls back linked Indent/PR to `'Approved'` status.
4. **Universal Regional Formatting:**
   - All tables, print invoices, and slips format dates in `en-IN` (`DD/MM/YYYY` / `DD/MM/YYYY, hh:mm A`).
   - Taxable base + GST (intra/inter) + Rounding are 100% mathematically synchronized.

---

## 🏗️ 3. UKHO Page Object Model (POM) Catalog (`e2e/pages/`)

| Page Object | Path | Description & Methods |
|---|---|---|
| **`BasePage`** | `e2e/pages/BasePage.js` | Core navigation, safe clicks, wait for ready, format validation assertions. |
| **`LoginPage`** | `e2e/pages/LoginPage.js` | `loginAsAdmin()`, `loginAsStoreManager()`, JWT persistence. |
| **`IndentPage`** | `e2e/pages/IndentPage.js` | `clickSMApprove()`, `clickConvertToPo()`, `clickConvertToCash()`, `clickEdit()`, `openA3Print()`. |
| **`PurchasePage`** | `e2e/pages/PurchasePage.js` | `createPo()`, `editPoDate()`, `approvePo()`, `deletePoAndVerifyRollback()`, `openPoPrint()`. |
| **`StorePage`** | `e2e/pages/StorePage.js` | `inwardGrn()`, `issueSiv()`, `fastInward()`, verify stock balance. |
| **`ProductionPage`** | `e2e/pages/ProductionPage.js` | `switchMachine()`, `assertReelsLoaded()`, view DPR logs. |
| **`QualityPage`** | `e2e/pages/QualityPage.js` | `approveTest()`, verify burst factor, GSM, and moisture tolerances. |
| **`HRPage`** | `e2e/pages/HRPage.js` | `openPayslipPrint()`, payroll run assertions. |
| **`FinancePage`** | `e2e/pages/FinancePage.js` | Payment transaction register, aging buckets rollup. |
| **`ReportsPage`** | `e2e/pages/ReportsPage.js` | `switchTab()`, `verifyDateCellsFormatted()` across all deep dives. |

---

## 📋 4. Test Specification Catalog (`e2e/specs/`)

1. **`master_enterprise_e2e.spec.js`**: Master end-to-end regression test executing the complete mill lifecycle from Production, Indents, POs, Stores, QA, HR, to Reports.
2. **`approvals_and_action_buttons.spec.js`**: Targeted tests verifying Store Manager Direct Approvals (`🛡️ SM Approve`), PO approval feedback, and reports dates.
3. **`purchase_order_lifecycle.spec.js`**: Tests backdated PO creation, adding items after raising, official print formatting, and atomic indent deletion rollback.
4. **`invoice_and_slip_dates.spec.js`**: Tests date rendering on POs, Issue Slips, PR Slips, and SIV vouchers.
5. **`store_inventory_flow.spec.js`**: Tests live stock deductions and ledger balance consistency.

---

## 🚀 5. How to Run Playwright Tests

```bash
# Run all E2E tests headless
npm run test:e2e

# Run with interactive UI mode
npx playwright test --ui

# Run specific master enterprise spec
npx playwright test e2e/specs/master_enterprise_e2e.spec.js

# Generate and view HTML test report
npx playwright show-report
```
