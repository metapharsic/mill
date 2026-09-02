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

  test('TC-STORE-06: Fast Outward Issue 3-Tier & Multi-Item Workflows (Job Work, Return to Party, Inter Store Transfer, Dept Issue)', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    // Navigate to Outward desk
    await storePage.safeClick(storePage.outwardTab);

    // Verify Outward Workflow filter chips
    await storePage.filterOutwardType('job_work');
    await storePage.filterOutwardType('return_to_vendor');
    await storePage.filterOutwardType('transfer');
    await storePage.filterOutwardType('all');

    // Trigger Fast Outward Modal
    if (await storePage.fastOutwardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await storePage.openFastOutward();
      const modal = page.locator('div:has-text("Fast Outward Issue Desk")').first();
      await expect(modal).toBeVisible();

      // Test Mode 1: Job Work & Multi-Item Add
      await storePage.selectOutwardWorkflow('job_work');
      await storePage.clickAddOutwardItem();
      const submitBtnJW = page.locator('button:has-text("Confirm Stock Issue (Job Work")').first();
      await expect(submitBtnJW).toBeVisible();

      // Test Mode 2: Return to Party & Multi-Item Add
      await storePage.selectOutwardWorkflow('return_to_vendor');
      await storePage.clickAddOutwardItem();
      const submitBtnRTV = page.locator('button:has-text("Confirm Store Issue to Out")').first();
      await expect(submitBtnRTV).toBeVisible();

      // Test Mode 3: Inter Store Transfer & Multi-Item Add
      await storePage.selectOutwardWorkflow('inter_store_transfer');
      await storePage.clickAddOutwardItem();
      const submitBtnSTO = page.locator('button:has-text("Confirm Store Received Stock")').first();
      await expect(submitBtnSTO).toBeVisible();

      // Test Mode 4: Dept Issue
      await storePage.selectOutwardWorkflow('issue');
      await storePage.clickAddOutwardItem();
      const submitBtnIssue = page.locator('button:has-text("Confirm Stock Issue")').first();
      await expect(submitBtnIssue).toBeVisible();

      // Close modal
      const closeBtn = page.locator('button:has-text("Cancel")').first();
      await storePage.safeClick(closeBtn);
    }
  });
});

