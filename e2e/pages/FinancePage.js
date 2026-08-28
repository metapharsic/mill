// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * FinancePage - UKHO Page Object Model for Accounts, Invoicing, Payments & Aging Analysis
 */
class FinancePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.recordPaymentBtn = page.locator('button:has-text("Record Payment"), button:has-text("+ Payment")').first();
    this.paymentsTable = page.locator('table').first();
    this.agingCard = page.locator('div:has-text("Aging")').first();
  }

  async goto() {
    await this.navigateTo('/finance');
    await this.waitForReady();
  }
}

module.exports = { FinancePage };
