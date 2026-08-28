// @ts-check
const { expect } = require('@playwright/test');

/**
 * BasePage - UK Hydrographic Office (UKHO) Standard Page Object Model Base Class
 * Encapsulates common browser interactions, wait strategies, accessibility hooks, and assertions.
 */
class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to a relative path
   * @param {string} path
   */
  async navigateTo(path) {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for network idle or stable state
   */
  async waitForReady() {
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  /**
   * Set authentication token in localStorage
   * @param {string} token
   * @param {object} [user]
   */
  async setAuthSession(token, user = { id: 1, name: 'Admin', role: 'admin', role_level: 'superadmin' }) {
    await this.page.addInitScript(({ token, user }) => {
      localStorage.setItem('mk_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('mk_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
    }, { token, user });
  }

  /**
   * Safe click with retry and visibility check
   * @param {string|import('@playwright/test').Locator} locator
   */
  async safeClick(locator) {
    const loc = typeof locator === 'string' ? this.page.locator(locator) : locator;
    await loc.waitFor({ state: 'visible', timeout: 10000 });
    await loc.click();
  }

  /**
   * Safe text fill
   * @param {string|import('@playwright/test').Locator} locator
   * @param {string} text
   */
  async safeFill(locator, text) {
    const loc = typeof locator === 'string' ? this.page.locator(locator) : locator;
    await loc.waitFor({ state: 'visible', timeout: 10000 });
    await loc.fill(text);
  }

  /**
   * Verify toast notification or banner
   * @param {string|RegExp} messagePattern
   */
  async expectToast(messagePattern) {
    const toast = this.page.locator('[role="alert"], .toast, .notification, text=' + messagePattern).first();
    await expect(toast).toBeVisible({ timeout: 8000 });
  }

  /**
   * Capture named screenshot artifact
   * @param {string} name
   */
  async captureScreenshot(name) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}

module.exports = { BasePage };
