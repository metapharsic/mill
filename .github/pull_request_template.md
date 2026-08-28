## 📋 Description & Context
<!-- Provide a concise summary of the changes and the business/engineering motivation. -->

## 🔗 Related Issues / Tickets
- Fixes #
- Relates to #

## 🛠️ Type of Change
- [ ] 🚀 New Feature (non-breaking change adding functionality)
- [ ] 🐛 Bug Fix (non-breaking change fixing an issue)
- [ ] 🛡️ Multi-tier Approval & Status Workflow Fix
- [ ] 🎨 UI / UX Refactoring & Template Alignment
- [ ] ⚡ Performance Optimization
- [ ] 🧪 Automated Test Suite (Playwright / E2E / Integration)
- [ ] 🔒 Security / Compliance / Accessibility

## 📦 Key Changes Implemented
- 
- 
- 

## 🛡️ Approvals & Action Buttons Gate (Mandatory Verification)
- [ ] **Direct Approvals Wired**: Verified `approve`, `l1_approve`, `l2_approve`, `l3_approve` endpoints respond 200 OK without 404/403 misrouting.
- [ ] **Role & Tier Bypass**: Admin / Director / Superadmin users bypass tier restrictions when executing approvals.
- [ ] **Visual Feedback**: Every action button click (`Approve`, `Edit`, `+PO`, `+Cash`, `Delete`, `Cancel`, `Sign`) provides immediate user feedback (toast/alert) on both success and rejection.
- [ ] **Audit Trail**: Every status change writes an entry to `store_indent_log` and `indent_audit_log` in the same transaction.
- [ ] **Rollback Integrity**: Deletions & cancellations atomically revert linked parent records (e.g. PO delete restores linked Indent to `'Approved'`).

## 📅 Universal Date & Calculation Formatting Gate
- [ ] **All Dates Formatted**: Guaranteed non-empty dates formatted in `en-IN` (`DD/MM/YYYY` / `DD/MM/YYYY, hh:mm A`) across all Reports tables, Invoices, Issue Slips, PR Slips, and Vouchers.
- [ ] **Calculations 100% Synced**: Base + GST (intra/inter) + Round-off + Grand Total match across backend database and frontend UI components.

## 🧪 E2E & Verification Evidence (UKHO Playwright Standards)
- [ ] E2E Automated Tests Added / Updated under `e2e/specs/`
- [ ] Page Object Model (`e2e/pages/`) pattern adhered to
- [ ] Playwright test matrix passing locally: `npm run test:e2e`
- [ ] Multi-Agent QA test script passing: `node backend/scripts/test_comprehensive_multi_agent_suite.js`

### Test Run Summary
```text
Running E2E tests using Playwright & Multi-Agent QA suite
✓ All approval endpoints, action buttons, date formatters, and calculations passed 100%
```

## 📸 Screenshots / Video Artifacts (if applicable)
<!-- Attach before/after screenshots or Playwright trace artifacts -->
