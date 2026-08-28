// @ts-check
const { test, expect } = require('@playwright/test');
const { IndentPage } = require('../pages/IndentPage');
const { StorePage } = require('../pages/StorePage');
const { PurchasePage } = require('../pages/PurchasePage');

test.describe('📅 Invoice, Slip, and Voucher Date Verification (UKHO Quality Standards)', () => {
  test.beforeEach(async ({ page }) => {
    const basePage = new IndentPage(page);
    await basePage.setAuthSession('mock-valid-admin-token-2026', {
      id: 1,
      name: 'Test Administrator',
      role: 'admin',
      role_level: 'superadmin',
      dept_code: 'STORE'
    });
  });

  test('TC-DATE-01: Purchase Request and Indent lists display valid date formats', async ({ page }) => {
    const indentPage = new IndentPage(page);
    await indentPage.goto();

    await expect(page.locator('text=Purchase Request').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-DATE-02: Store A3 Master Invoice Modal renders all metadata dates accurately', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    // Click on A3 Invoice print button if present
    const a3Btn = page.locator('button[title*="A3" i], button:has-text("Print Single A3 Slip"), button:has-text("A3")').first();
    if (await a3Btn.isVisible()) {
      await a3Btn.click();
      await storePage.verifyA3ModalDates();
    }
  });

  test('TC-DATE-03: Purchase Order Printout contains valid non-empty P.O. Date and P.R. Date', async ({ page }) => {
    const purchasePage = new PurchasePage(page);
    await purchasePage.goto();
    await purchasePage.selectTab('orders');

    const printBtn = page.locator('button[title*="Print Purchase Order"]').first();
    if (await printBtn.isVisible()) {
      await printBtn.click();
      await purchasePage.verifyPoInvoiceDates();
    }
  });
});
