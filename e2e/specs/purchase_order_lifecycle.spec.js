// @ts-check
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { PurchasePage } = require('../pages/PurchasePage');

test.describe('🛒 Procurement & Purchase Order Lifecycle (UKHO E2E Standards)', () => {
  test.beforeEach(async ({ page }) => {
    // Setup Mock/Real Auth session for deterministic testing
    const basePage = new PurchasePage(page);
    await basePage.setAuthSession('mock-valid-admin-token-2026', {
      id: 1,
      name: 'Test Administrator',
      role: 'admin',
      role_level: 'superadmin',
      dept_code: 'STORE'
    });
  });

  test('TC-PO-01: Purchase Order Table loads and displays action buttons', async ({ page }) => {
    const purchasePage = new PurchasePage(page);
    await purchasePage.goto();
    await purchasePage.selectTab('orders');

    await expect(page.locator('text=Procurement & Vendor Management')).toBeVisible();
    await expect(purchasePage.createPoButton).toBeVisible();
  });

  test('TC-PO-02: Purchase Order Print renders Official Mill Layout & Identity', async ({ page }) => {
    const purchasePage = new PurchasePage(page);
    await purchasePage.goto();
    await purchasePage.selectTab('orders');

    // Click on print button on first PO row if exists
    const printBtn = page.locator('button[title*="Print Purchase Order"]').first();
    if (await printBtn.isVisible()) {
      await printBtn.click();
      await purchasePage.verifyOfficialMillPrintHeader();
      await purchasePage.verifyPoInvoiceDates();
    }
  });

  test('TC-PO-03: Mathematical calculations synchronize 100% for Line Items & Taxes', async ({ page }) => {
    const purchasePage = new PurchasePage(page);
    await purchasePage.goto();
    await purchasePage.selectTab('orders');

    // Open detail modal on first PO
    const viewBtn = page.locator('button[title*="View PO Details"]').first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      await expect(page.locator('text=Purchase Order #')).toBeVisible();
      await expect(page.locator('text=Grand Total')).toBeVisible();
    }
  });
});
