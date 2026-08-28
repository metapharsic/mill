---
name: 🧪 E2E Test Plan (UKHO Playwright Standards)
about: Plan and track automated end-to-end testing coverage
title: '[E2E TEST PLAN]: '
labels: ['testing', 'playwright', 'quality-assurance']
assignees: ''
---

## 🎯 Target Module / Workflow
<!-- e.g. Purchase Order Lifecycle, Backdated Procurement, Store SIV/GRN, Indents, Approvals & Action Buttons, Reports Dates -->

## 🏗️ Page Objects Involved (`e2e/pages/`)
- [ ] `BasePage.js`
- [ ] `LoginPage.js`
- [ ] `PurchasePage.js`
- [ ] `IndentPage.js`
- [ ] `StorePage.js`
- [ ] `ReportsPage.js`

## 📋 Test Matrix & Scenarios
| Scenario ID | Test Case Description | Expected Result | Automated Spec |
|---|---|---|---|
| TC-01 | Create PO with backdated date | PO created with custom past date | `purchase_order_lifecycle.spec.js` |
| TC-02 | Add items to raised PO | Line items appended, math recalculated | `purchase_order_lifecycle.spec.js` |
| TC-03 | Delete PO with linked Indent | Indent reverted to 'Approved' | `purchase_order_lifecycle.spec.js` |
| TC-04 | Print Issue Slip & PR | All date fields populated with DD/MM/YYYY | `invoice_and_slip_dates.spec.js` |
| TC-05 | Inward GRN to Outward SIV | Live stock balance adjusted atomically | `store_inventory_flow.spec.js` |
| TC-06 | Indent SM Direct Approval | Status transitioned to 'Approved' without 404 error | `approvals_and_action_buttons.spec.js` |
| TC-07 | PO Direct Approval & Admin Override | Admin bypasses tier restrictions & updates status | `approvals_and_action_buttons.spec.js` |
| TC-08 | 1-Click Indent to PO Conversion | Creates linked PO and transitions indent to 'PO Created' | `approvals_and_action_buttons.spec.js` |
| TC-09 | Reports Tables Uniform Date Rendering | All table cells display valid regional DD/MM/YYYY dates | `approvals_and_action_buttons.spec.js` |

## 📊 Quality Gates & Pass Criteria
- [ ] 0 test failures in Chromium, Firefox, WebKit
- [ ] Traces and video recorded on retry
- [ ] Accessibility checks passed without critical axe violations
- [ ] Universal date formatting verified across all reporting and print templates
