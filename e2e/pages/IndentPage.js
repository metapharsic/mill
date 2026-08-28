// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * IndentPage - UKHO Page Object Model for Indents / Store Requisitions and Action Flows
 */
class IndentPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.createIndentBtn = page.locator('button:has-text("Create Indent"), button:has-text("+ New Indent")').first();
    this.indentTable = page.locator('table').first();
    this.filterInput = page.locator('input[placeholder*="filter" i], input[placeholder*="search" i]').first();
    this.refreshBtn = page.locator('button:has-text("Refresh")').first();
  }

  async goto() {
    await this.navigateTo('/indent');
    await this.waitForReady();
  }

  /**
   * Click Store Manager Approval button on an indent row
   * @param {number} [index]
   */
  async clickSMApprove(index = 0) {
    const btn = this.page.locator('button:has-text("SM Approve"), button[title*="Store Manager Direct Approval" i]').nth(index);
    await this.safeClick(btn);
  }

  /**
   * Click 1-Click PO conversion button
   * @param {number} [index]
   */
  async clickConvertToPo(index = 0) {
    const btn = this.page.locator('button:has-text("+PO"), button[title*="Convert Indent to Purchase Order" i]').nth(index);
    await this.safeClick(btn);
  }

  /**
   * Click 1-Click Cash conversion button
   * @param {number} [index]
   */
  async clickConvertToCash(index = 0) {
    const btn = this.page.locator('button:has-text("+Cash"), button[title*="Convert Indent to Cash Purchase" i]').nth(index);
    await this.safeClick(btn);
  }

  /**
   * Click Edit button
   * @param {number} [index]
   */
  async clickEdit(index = 0) {
    const btn = this.page.locator('button:has-text("Edit"), button[title*="Edit this Indent" i]').nth(index);
    await this.safeClick(btn);
  }

  /**
   * Click View / Detail button
   * @param {number} [index]
   */
  async clickView(index = 0) {
    const btn = this.page.locator('button:has-text("View"), button[title*="View" i]').nth(index);
    await this.safeClick(btn);
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
