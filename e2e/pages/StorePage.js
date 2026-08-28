// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * StorePage - Page Object Model for Central Store Management (Inward GRN, Outward SIV, A3 Invoice Slips)
 */
class StorePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.inwardTab = page.locator('button:has-text("Inward"), button:has-text("GRN")').first();
    this.outwardTab = page.locator('button:has-text("Outward"), button:has-text("SIV")').first();
  }

  async goto() {
    await this.navigateTo('/store');
    await this.waitForReady();
  }

  async verifyA3ModalDates() {
    const a3Wrapper = this.page.locator('#a3-print-wrapper');
    await expect(a3Wrapper).toBeVisible();
    
    // Check Voucher Date, GRN Date, Order Date
    const voucherDate = a3Wrapper.locator('text=Voucher Date').locator('..');
    await expect(voucherDate).toBeVisible();
    const grnDate = a3Wrapper.locator('text=GRN Date').locator('..');
    await expect(grnDate).toBeVisible();
  }
}

module.exports = { StorePage };
