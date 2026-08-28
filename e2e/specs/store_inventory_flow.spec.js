// @ts-check
const { test, expect } = require('@playwright/test');
const { StorePage } = require('../pages/StorePage');

test.describe('📦 Central Store Inward & Outward Inventory Workflow (UKHO POM Standards)', () => {
  test.beforeEach(async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.setAuthSession('mock-valid-admin-token-2026', {
      id: 1,
      name: 'Test Administrator',
      role: 'admin',
      role_level: 'superadmin',
      dept_code: 'STORE'
    });
  });

  test('TC-STORE-01: Store page loads Inward Goods Receipt Notes & Outward SIV tabs', async ({ page }) => {
    const storePage = new StorePage(page);
    await storePage.goto();

    await expect(page.locator('text=Store').first()).toBeVisible();
    await expect(storePage.inwardTab).toBeVisible();
    await expect(storePage.outwardTab).toBeVisible();
  });
});
