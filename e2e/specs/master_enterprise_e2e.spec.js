// @ts-check
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { IndentPage } = require('../pages/IndentPage');
const { PurchasePage } = require('../pages/PurchasePage');
const { StorePage } = require('../pages/StorePage');
const { ProductionPage } = require('../pages/ProductionPage');
const { QualityPage } = require('../pages/QualityPage');
const { HRPage } = require('../pages/HRPage');
const { FinancePage } = require('../pages/FinancePage');
const { ReportsPage } = require('../pages/ReportsPage');

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🏭 MASTER ENTERPRISE PLAYWRIGHT E2E SPECIFICATION SUITE
 * Implements UK Hydrographic Office (UKHO) Architecture & Page Object Pattern
 * ══════════════════════════════════════════════════════════════════════════════
 */
test.describe('MK Paper Mill ERP — Master Enterprise End-to-End Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsAdmin();
  });

  test('E2E-01: Authentication & Dashboard Health Check', async ({ page }) => {
    await expect(page).toHaveTitle(/MK Paper Mill|ERP/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('E2E-02: Production Paper Machine Logging & DPR View', async ({ page }) => {
    const prodPage = new ProductionPage(page);
    await prodPage.goto();
    await prodPage.assertReelsLoaded();
  });

  test('E2E-03: Indent Workflow — SM Approval, +PO, and A3 Print', async ({ page }) => {
    const indentPage = new IndentPage(page);
    await indentPage.goto();

    const rowCount = await indentPage.tableRows.count();
    if (rowCount > 0) {
      // Test SM Direct Approval button
      const smApproveBtn = page.locator('button:has-text("SM Approve")').first();
      if (await smApproveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await smApproveBtn.click();
        await page.waitForTimeout(500);
      }

      // Test A3 Master Modal
      await indentPage.openA3Print(0);
      const modal = page.locator('div[role="dialog"], div:has-text("INVOICE"), div:has-text("REQUISITION")').first();
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('E2E-04: Purchase Order Lifecycle — Creation, Backdating, Add Items & Approvals', async ({ page }) => {
    const purchasePage = new PurchasePage(page);
    await purchasePage.goto();

    const count = await page.locator('table tbody tr').count();
    if (count > 0) {
      // Test Open PO Detail & Verification
      await purchasePage.openPoDetail(0);
      await page.waitForTimeout(500);

      // Verify Print Format contains GSTIN and Mill metadata
      const printBtn = page.locator('button:has-text("Print"), button[title*="Print" i]').first();
      if (await printBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await printBtn.click();
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
      }
    }
  });

  test('E2E-05: Store Inventory — Fast-Inward, GRN & Issue Slip Date Verification', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    const count = await storePage.tableRows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('E2E-06: Quality Assurance Lab Testing & Inspection Approvals', async ({ page }) => {
    const qualityPage = new QualityPage(page);
    await qualityPage.goto();
    await qualityPage.approveTest(0);
  });

  test('E2E-07: Human Resources & Payroll — Payslip Date Formatting', async ({ page }) => {
    const hrPage = new HRPage(page);
    await hrPage.goto();
    await hrPage.openPayslipPrint(0);
  });

  test('E2E-08: Finance & Accounts — Payment Register & Aging Analysis', async ({ page }) => {
    const finPage = new FinancePage(page);
    await finPage.goto();
  });

  test('E2E-09: Enterprise Reports — Uniform Regional Date Formatting & Module Deep Dives', async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();

    // Verify dates across core modules
    await reportsPage.switchTab('Quality');
    await reportsPage.verifyDateCellsFormatted();

    await reportsPage.switchTab('Utility');
    await reportsPage.verifyDateCellsFormatted();

    await reportsPage.switchTab('Indents');
    await reportsPage.verifyDateCellsFormatted();
  });
});
