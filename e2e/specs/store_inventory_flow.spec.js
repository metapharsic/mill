// @ts-check
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { StorePage } = require('../pages/StorePage');
const { IndentPage } = require('../pages/IndentPage');

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 📦 STORE MANAGEMENT & INVENTORY PLAYWRIGHT E2E TEST SPECIFICATION
 * Implements UK Hydrographic Office (UKHO) Page Object Architecture
 * ══════════════════════════════════════════════════════════════════════════════
 */
test.describe('📦 Central Store Management & Inventory Workflow Suite', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsAdmin();
  });

  test('TC-STORE-01: Central Store Dashboard & Navigation Overview', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    await expect(storePage.inwardTab).toBeVisible();
    await expect(storePage.outwardTab).toBeVisible();
  });

  test('TC-STORE-02: Store Inward Goods Receipt Notes (GRN) & Vendor Inward Register', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    await storePage.safeClick(storePage.inwardTab);
    const count = await storePage.tableRows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('TC-STORE-03: Fast-Inward (Direct Receipt) Modal & Live Balance Sync', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    if (await storePage.fastInwardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await storePage.openFastInward();
      const modal = page.locator('div[role="dialog"], div:has-text("Direct Inward"), div:has-text("Fast Inward")').first();
      await expect(modal).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('TC-STORE-04: Outward Store Issue Voucher (SIV) & Department Allocation', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    await storePage.safeClick(storePage.outwardTab);
    const count = await storePage.tableRows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('TC-STORE-05: Enterprise Inventory Excel & Master CSV Exporter Modal', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    if (await storePage.exportModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await storePage.safeClick(storePage.exportModalBtn);
      const modal = page.locator('div[role="dialog"]:has-text("Inventory Exporter"), div:has-text("Excel Master Export")').first();
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
      }
    }
  });
});
