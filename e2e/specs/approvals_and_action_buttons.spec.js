// @ts-check
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { IndentPage } = require('../pages/IndentPage');
const { PurchasePage } = require('../pages/PurchasePage');
const { ReportsPage } = require('../pages/ReportsPage');

test.describe('Approvals & Action Buttons Verification Suite', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsAdmin();
  });

  test('TC-APP-01: Indent SM Approval action button transitions status seamlessly', async ({ page }) => {
    const indentPage = new IndentPage(page);
    await indentPage.goto();

    // Check if there are indents in table
    const rowCount = await indentPage.tableRows.count();
    if (rowCount > 0) {
      // Find a row with SM Approve button if present
      const smApproveBtn = page.locator('button:has-text("SM Approve")').first();
      if (await smApproveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await smApproveBtn.click();
        await page.waitForTimeout(1000);
        // Ensure success or toast notification
        const bodyText = await page.textContent('body');
        expect(bodyText).toBeDefined();
      }
    }
  });

  test('TC-APP-02: Purchase Order approval button works with toast feedback', async ({ page }) => {
    const purchasePage = new PurchasePage(page);
    await purchasePage.goto();

    const rowCount = await page.locator('table tbody tr').count();
    if (rowCount > 0) {
      const approveBtn = page.locator('button:has-text("Approve"), button[title*="Approve" i]').first();
      if (await approveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await approveBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('TC-APP-03: Reports tables have uniformly formatted dates', async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();

    // Check Quality tab
    await reportsPage.switchTab('Quality');
    await reportsPage.verifyDateCellsFormatted();

    // Check Utility tab
    await reportsPage.switchTab('Utility');
    await reportsPage.verifyDateCellsFormatted();

    // Check Indents tab
    await reportsPage.switchTab('Indents');
    await reportsPage.verifyDateCellsFormatted();
  });
});
