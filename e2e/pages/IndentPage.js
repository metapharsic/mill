// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * IndentPage - Page Object Model for Indents / Store Requisitions and Issue Slips
 */
class IndentPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.createIndentBtn = page.locator('button:has-text("Create Indent"), button:has-text("+ New Indent")').first();
    this.indentTable = page.locator('table').first();
  }

  async goto() {
    await this.navigateTo('/indent');
    await this.waitForReady();
  }

  /**
   * Open A3 Master Indent print modal
   * @param {number} [index]
   */
  async openA3Print(index = 0) {
    const printBtn = this.page.locator('button[title*="A3" i], button:has-text("A3")').nth(index);
    await this.safeClick(printBtn);
  }
}

module.exports = { IndentPage };
