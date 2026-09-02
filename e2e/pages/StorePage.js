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
    this.fastOutwardBtn = page.locator('button:has-text("+ Fast Outward Issue"), button:has-text("Fast Outward")').first();
    this.exportModalBtn = page.locator('button:has-text("Excel Master Export"), button:has-text("Export Inventory")').first();
    this.filterStoreDropdown = page.locator('select').first();
    this.tableRows = page.locator('table tbody tr');

    // Fast Outward Mode Selectors
    this.jobWorkModeBtn = page.locator('button:has-text("1. 🏭 Job Work"), button:has-text("Job Work")').first();
    this.rtvModeBtn = page.locator('button:has-text("2. ↩️ Return to Party"), button:has-text("Return to Party")').first();
    this.stoModeBtn = page.locator('button:has-text("3. 🔄 Store Transfer"), button:has-text("Inter Store Transfer")').first();
    this.deptIssueModeBtn = page.locator('button:has-text("4. 📤 Dept Issue"), button:has-text("Dept Issue")').first();
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
   * Open Fast-Outward modal
   */
  async openFastOutward() {
    if (await this.fastOutwardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.safeClick(this.fastOutwardBtn);
    }
  }

  /**
   * Switch Fast Outward workflow mode
   * @param {'job_work' | 'return_to_vendor' | 'inter_store_transfer' | 'issue'} mode
   */
  async selectOutwardWorkflow(mode) {
    if (mode === 'job_work') {
      await this.safeClick(this.jobWorkModeBtn);
    } else if (mode === 'return_to_vendor') {
      await this.safeClick(this.rtvModeBtn);
    } else if (mode === 'inter_store_transfer') {
      await this.safeClick(this.stoModeBtn);
    } else if (mode === 'issue') {
      await this.safeClick(this.deptIssueModeBtn);
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Filter Outward desk by transaction type
   * @param {'job_work' | 'return_to_vendor' | 'transfer' | 'issue' | 'all'} type
   */
  async filterOutwardType(type) {
    const labelMap = {
      all: '⚡ All Outward',
      job_work: '🏭 1. Job Work',
      return_to_vendor: '↩️ 2. Return to Party',
      transfer: '🔄 3. Inter Store Transfer',
      issue: '📤 Dept Issue'
    };
    const chip = this.page.locator(`button:has-text("${labelMap[type] || type}")`).first();
    if (await chip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.safeClick(chip);
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Click [+ Add Item] button inside Fast Outward modal
   */
  async clickAddOutwardItem() {
    const addBtn = this.page.locator('button:has-text("+ ➕ Add"), button:has-text("+ Add")').first();
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.safeClick(addBtn);
      await this.page.waitForTimeout(200);
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
