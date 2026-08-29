// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * InboundDcPage - Page Object Model for the "Match Vendor Invoice Against
 * Received DC(s)" tick-mark reconciliation card inside Store.jsx's Inward
 * modal (Ref Document = "DC #"). New file, does not modify StorePage.js.
 */
class InboundDcPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.newInwardBtn = page.locator('button:has-text("+ New Inward (GRN)"), button:has-text("+ Fast Inward Entry")').first();
    this.refDocumentSelect = page.locator('select').filter({ has: page.locator('option:has-text("DC #")') }).first();
    this.matchCard = page.locator('div:has-text("Match Vendor Invoice Against Received DC(s)")').first();
    this.partyNameInput = page.getByPlaceholder('Party / vendor name as on invoice');
    this.invoiceNumberInput = page.getByPlaceholder('e.g. INV-8902').last();
    this.invoiceTotalInput = this.matchCard.locator('input[type="number"]').first();
    this.dcTable = this.matchCard.locator('table');
    this.dcCheckboxes = this.dcTable.locator('tbody input[type="checkbox"]');
    this.matchPill = page.locator('text=/Matches Invoice|Mismatch vs Invoice/').first();
    this.noDcsMessage = page.locator('text=No DCs are pending invoice match');
    this.submitBtn = page.locator('button:has-text("Match")').last();
  }

  /**
   * Open the Inward modal and switch Ref Document to "DC #".
   */
  async openDcMatchCard() {
    if (await this.newInwardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.safeClick(this.newInwardBtn);
    }
    if (await this.refDocumentSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.refDocumentSelect.selectOption({ label: 'DC #' });
      await this.page.waitForTimeout(400);
    }
  }

  /**
   * Tick the checkbox for the Nth DC row (0-indexed).
   * @param {number} index
   */
  async tickDc(index = 0) {
    const cb = this.dcCheckboxes.nth(index);
    if (await cb.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cb.check();
    }
  }

  /**
   * Fill Rate / Disc% / Tax Amount for the first editable row.
   * @param {{rate?: string, discPct?: string, taxAmount?: string}} values
   */
  async fillFirstLineEdit({ rate, discPct, taxAmount } = {}) {
    const row = this.dcTable.locator('tbody tr').first();
    const numberInputs = row.locator('input[type="number"]');
    if (rate !== undefined) await numberInputs.nth(0).fill(rate);
    if (discPct !== undefined) await numberInputs.nth(1).fill(discPct);
    if (taxAmount !== undefined) await numberInputs.nth(2).fill(taxAmount);
  }

  /**
   * @param {string} name
   */
  async fillPartyName(name) {
    await this.safeFill(this.partyNameInput, name);
  }

  /**
   * @param {string} num
   */
  async fillInvoiceNumber(num) {
    await this.safeFill(this.invoiceNumberInput, num);
  }

  /**
   * @param {string} total
   */
  async fillInvoiceTotal(total) {
    await this.safeFill(this.invoiceTotalInput, total);
  }

  /**
   * Assert the live match indicator pill shows the expected state.
   * @param {'match'|'mismatch'} expected
   */
  async expectMatchIndicator(expected) {
    const text = expected === 'match' ? /Matches Invoice/ : /Mismatch vs Invoice/;
    await expect(this.page.locator('span', { hasText: text }).first()).toBeVisible({ timeout: 5000 });
  }
}

module.exports = { InboundDcPage };
