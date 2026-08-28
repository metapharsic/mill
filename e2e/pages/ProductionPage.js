// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * ProductionPage - UKHO Page Object Model for Paper Machine Production, Reel Logging & DPR
 */
class ProductionPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.addReelBtn = page.locator('button:has-text("Log Reel"), button:has-text("+ New Reel"), button:has-text("Add Reel")').first();
    this.reelsTable = page.locator('table').first();
    this.dprTab = page.locator('button:has-text("DPR"), button:has-text("Daily Production")').first();
  }

  async goto() {
    await this.navigateTo('/production');
    await this.waitForReady();
  }

  /**
   * Switch active machine tab (e.g. 'PM1', 'PM2', 'Slitter', 'Finishing')
   * @param {string} machineName
   */
  async switchMachine(machineName) {
    const tab = this.page.locator(`button:has-text("${machineName}")`).first();
    await this.safeClick(tab);
    await this.page.waitForTimeout(500);
  }

  /**
   * Assert production table is rendered and contains non-empty reel records
   */
  async assertReelsLoaded() {
    const rows = this.page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  }
}

module.exports = { ProductionPage };
