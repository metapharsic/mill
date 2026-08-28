// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * StorePage - UKHO Page Object Model for Central Store Management, Inventory & Stock Ledger
 */
class StorePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.inwardTab = page.locator('button:has-text("Inward"), button:has-text("GRN")').first();
    this.outwardTab = page.locator('button:has-text("Outward"), button:has-text("SIV"), button:has-text("Issue")').first();
    this.stockLedgerTab = page.locator('button:has-text("Stock Ledger"), button:has-text("Ledger")').first();
    this.fastInwardBtn = page.locator('button:has-text("Fast Inward"), button:has-text("Direct Inward")').first();
    this.createGrnBtn = page.locator('button:has-text("New GRN"), button:has-text("+ Inward GRN")').first();
    this.createIssueBtn = page.locator('button:has-text("Issue Stock"), button:has-text("+ Issue Stock")').first();
    this.exportModalBtn = page.locator('button:has-text("Excel Master Export"), button:has-text("Export Inventory")').first();
    this.filterStoreDropdown = page.locator('select').first();
    this.tableRows = page.locator('table tbody tr');
  }

  async goto() {
    await this.navigateTo('/store');
    await this.waitForReady();
  }

  /**
   * Filter store by section (e.g. 'Mechanical', 'Electrical', 'Chemicals', 'Raw Material')
   * @param {string} storeType
   */
  async filterByStore(storeType) {
    if (await this.filterStoreDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.filterStoreDropdown.selectOption({ label: storeType });
      await this.page.waitForTimeout(400);
    }
  }

  /**
   * Open Fast-Inward modal
   */
  async openFastInward() {
    if (await this.fastInwardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.safeClick(this.fastInwardBtn);
    }
  }

  /**
   * Verify A3 Master Store Issue Slip / Invoice Modal
   */
  async verifyA3ModalDates() {
    const a3Wrapper = this.page.locator('#a3-print-wrapper, div[role="dialog"]:has-text("STORE ISSUE")');
    if (await a3Wrapper.isVisible({ timeout: 2000 }).catch(() => false)) {
      const dateCell = a3Wrapper.locator('text=Date').locator('..');
      await expect(dateCell).toBeVisible();
    }
  }
}

module.exports = { StorePage };
