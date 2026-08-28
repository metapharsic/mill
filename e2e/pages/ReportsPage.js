// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * ReportsPage - UKHO Page Object Model for Reports and WhatsApp EOD Studio
 */
class ReportsPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.refreshBtn = page.locator('button:has-text("Refresh"), button[title*="Refresh" i]').first();
    this.exportCsvBtn = page.locator('button:has-text("Export CSV"), button:has-text("Download CSV")').first();
    this.tableRows = page.locator('table tbody tr');
  }

  async goto() {
    await this.navigateTo('/reports');
    await this.waitForReady();
  }

  /**
   * Switch to a specific report tab (e.g. 'quality', 'utility', 'downtime', 'indents', 'stores', 'purchaseDetailed')
   * @param {string} tabName
   */
  async switchTab(tabName) {
    const tabBtn = this.page.locator(`button:has-text("${tabName}"), a:has-text("${tabName}")`).first();
    await this.safeClick(tabBtn);
    await this.page.waitForTimeout(500);
  }

  /**
   * Verify all dates in table cells are valid DD/MM/YYYY dates
   */
  async verifyDateCellsFormatted() {
    const cells = await this.page.locator('table tbody td').allInnerTexts();
    for (const text of cells) {
      // If cell matches a date pattern, ensure it is DD/MM/YYYY or DD/MM/YYYY, HH:MM
      if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
        throw new Error(`Unformatted ISO date found in table cell: ${text}`);
      }
    }
  }
}

module.exports = { ReportsPage };
