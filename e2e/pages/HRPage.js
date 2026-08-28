// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * HRPage - UKHO Page Object Model for Human Resources, Attendance, Payroll & Payslips
 */
class HRPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.payrollTab = page.locator('button:has-text("Payroll"), button:has-text("Salary Processing")').first();
    this.attendanceTab = page.locator('button:has-text("Attendance"), button:has-text("Daily Attendance")').first();
    this.payslipsTable = page.locator('table').first();
  }

  async goto() {
    await this.navigateTo('/hr');
    await this.waitForReady();
  }

  /**
   * Open Payslip Print modal
   * @param {number} [index]
   */
  async openPayslipPrint(index = 0) {
    const btn = this.page.locator('button:has-text("Payslip"), button[title*="Payslip" i]').nth(index);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.safeClick(btn);
    }
  }
}

module.exports = { HRPage };
