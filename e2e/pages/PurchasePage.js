// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * PurchasePage - Page Object Model for Procurement & Purchase Orders
 * Validates PO creation, backdating, line additions, calculation synchronization, approvals, and official print format.
 */
class PurchasePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.createPoButton = page.locator('button:has-text("+ Create PO"), button:has-text("Create PO")').first();
    this.poDateInput = page.locator('input[type="date"]').first();
    this.vendorSelect = page.locator('input[placeholder*="Search vendor" i], select').first();
    this.savePoButton = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Save PO")').first();
    this.poTable = page.locator('table').first();
    this.printModal = page.locator('#print-document, .print-watermark-container').first();
  }

  async goto() {
    await this.navigateTo('/purchase');
    await this.waitForReady();
  }

  /**
   * Select PO tab
   * @param {'pr'|'orders'|'cash'|'grn'|'bills'|'pipeline'} tabName
   */
  async selectTab(tabName) {
    const tabLocator = this.page.locator(`button:has-text("${tabName === 'orders' ? 'Purchase Orders' : tabName}")`).first();
    await this.safeClick(tabLocator);
    await this.waitForReady();
  }

  /**
   * Verify that Official Sri M.K. Paper Mills Print Header is rendered correctly
   */
  async verifyOfficialMillPrintHeader() {
    await expect(this.page.locator('text=Sri M.K. Paper Mills Pvt. Ltd').first()).toBeVisible();
    await expect(this.page.locator('text=9885488816').first()).toBeVisible();
    await expect(this.page.locator('text=36AARCS3180K1ZS').first()).toBeVisible();
    await expect(this.page.locator('text=PURCHASE ORDER').first()).toBeVisible();
    await expect(this.page.locator('text=Store Dept').first()).toBeVisible();
    await expect(this.page.locator('text=Head Of Dept').first()).toBeVisible();
    await expect(this.page.locator('text=M.D Approval').first()).toBeVisible();
  }

  /**
   * Verify date is formatted and present on invoice print
   */
  async verifyPoInvoiceDates() {
    const poDateRow = this.page.locator('span:has-text("P.O. Date:") + span');
    await expect(poDateRow).toBeVisible();
    const dateText = await poDateRow.textContent();
    expect(dateText).toMatch(/\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/);
  }
}

module.exports = { PurchasePage };
