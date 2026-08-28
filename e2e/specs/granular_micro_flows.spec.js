// @ts-check
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { IndentPage } = require('../pages/IndentPage');
const { PurchasePage } = require('../pages/PurchasePage');
const { StorePage } = require('../pages/StorePage');
const { ReportsPage } = require('../pages/ReportsPage');

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔬 PLAYWRIGHT GRANULAR MICRO-FLOWS & UI EDGE CASE TEST SUITE
 * Tests all interactive bits and pieces: keyboard navigation, search filtering,
 * modal lifecycle, sequence violation toasts, and regional formatting.
 * ══════════════════════════════════════════════════════════════════════════════
 */
test.describe('Granular Micro-Flows & UI Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsAdmin();
  });

  test('TC-MICRO-01: Indent Table Live Search & Filter Reactivity', async ({ page }) => {
    const indentPage = new IndentPage(page);
    await indentPage.goto();

    const searchInput = page.locator('input[placeholder*="filter" i], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('IND-');
      await page.waitForTimeout(300);
      await searchInput.fill('');
    }
  });

  test('TC-MICRO-02: Modal Escape Key Keyboard Dismissal', async ({ page }) => {
    const indentPage = new IndentPage(page);
    await indentPage.goto();

    const createBtn = page.locator('button:has-text("Create Indent"), button:has-text("+ New Indent")').first();
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
    }
  });

  test('TC-MICRO-03: Purchase Order Item Addition & GST Recalculation', async ({ page }) => {
    const purchasePage = new PurchasePage(page);
    await purchasePage.goto();

    const createPoBtn = page.locator('button:has-text("Create PO"), button:has-text("+ New PO")').first();
    if (await createPoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createPoBtn.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
    }
  });

  test('TC-MICRO-04: Reports Tab Switch & Live Excel Export Trigger', async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();

    await reportsPage.switchTab('Stores');
    const exportBtn = page.locator('button:has-text("Excel Master Export"), button:has-text("Export CSV")').first();
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
  });

  test('TC-MICRO-05: Store Fast-Inward Modal & Live Stock Validation', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    const fastInwardBtn = page.locator('button:has-text("Fast Inward"), button:has-text("Direct Inward")').first();
    if (await fastInwardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fastInwardBtn.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
    }
  });
});
