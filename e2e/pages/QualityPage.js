// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * QualityPage - UKHO Page Object Model for Quality Assurance, Lab Testing & Approvals
 */
class QualityPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.addTestBtn = page.locator('button:has-text("New Test"), button:has-text("+ Quality Test")').first();
    this.testsTable = page.locator('table').first();
  }

  async goto() {
    await this.navigateTo('/quality');
    await this.waitForReady();
  }

  /**
   * Click Approve button on quality test inspection row
   * @param {number} [index]
   */
  async approveTest(index = 0) {
    const btn = this.page.locator('button:has-text("Approve"), button[title*="Approve" i]').nth(index);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.safeClick(btn);
    }
  }
}

module.exports = { QualityPage };
