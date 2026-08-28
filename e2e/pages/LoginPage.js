// @ts-check
const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * LoginPage - Page Object Model for MK Paper Mill ERP Authentication
 */
class LoginPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
  }

  async goto() {
    await this.navigateTo('/login');
  }

  /**
   * Login with credentials
   * @param {string} email
   * @param {string} password
   */
  async login(email = 'admin@mkmill.com', password = 'password123') {
    await this.goto();
    if (await this.emailInput.isVisible()) {
      await this.safeFill(this.emailInput, email);
      await this.safeFill(this.passwordInput, password);
      await this.safeClick(this.loginButton);
      await this.page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    }
  }
}

module.exports = { LoginPage };
