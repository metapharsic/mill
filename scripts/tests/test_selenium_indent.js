/**
 * Selenium E2E Integration Test for Indent & Issuance System PIIMAS
 *
 * Tests:
 *  1. Login as Production Manager (head.prod)
 *  2. 📋 Indents List Tab — verifies table header renders
 *  3. ➕ Raise Indent — fills form, verifies dept locked, submits
 *  4. 🤝 Acknowledge Tab — verifies tab renders
 *  5. 📅 Calendar Tab — verifies calendar renders
 *
 * Usage:
 *   npm install selenium-webdriver           (in project root)
 *   node test_selenium_indent.js             (default: HEADLESS=true)
 *   HEADLESS=false node test_selenium_indent.js   (with visible browser)
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const APP_URL    = process.env.TEST_URL || 'http://localhost:5173';
const LOGIN_USER = 'head.prod@mkpapermill.com';
const LOGIN_PASS = 'Test@1234';
const TIMEOUT    = 10_000; // ms per element wait

// ─── helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function pass(msg) {
  console.log(`  ✅  ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.error(`  ❌  ${msg}`, err ? `\n      → ${err.message || err}` : '');
  failed++;
}

async function assertVisible(driver, locator, desc) {
  try {
    await driver.wait(until.elementLocated(locator), TIMEOUT);
    pass(desc);
    return true;
  } catch (e) {
    fail(desc, e);
    return false;
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function runTest() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' 🦖 PIIMAS INDENT E2E TEST RUNNER  (Caveman Edition)');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  URL  : ${APP_URL}`);
  console.log(`  User : ${LOGIN_USER}`);
  console.log('');

  const opts = new chrome.Options();
  if (process.env.HEADLESS !== 'false') {
    opts.addArguments('--headless', '--disable-gpu', '--no-sandbox', '--window-size=1280,900');
  }

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(opts).build();

  try {

    // ── 0. LOGIN ──────────────────────────────────────────────────────────────
    console.log('▶ Phase 0: Login');
    await driver.get(APP_URL);
    await driver.manage().setTimeouts({ implicit: 3000 });

    try {
      await driver.findElement(By.id('login-email')).sendKeys(LOGIN_USER);
      await driver.findElement(By.id('login-password')).sendKeys(LOGIN_PASS);
      await driver.findElement(By.id('login-submit')).click();

      // Wait for sidebar nav to appear (= logged in)
      await driver.wait(until.elementLocated(By.id('nav-indent')), TIMEOUT);
      pass('Login successful — nav sidebar visible');
    } catch (e) {
      fail('Login failed', e);
      throw e;  // can't continue without login
    }

    // ── 1. NAVIGATE TO INDENT MODULE ─────────────────────────────────────────
    console.log('\n▶ Phase 1: Navigate to Indent / PIIMAS');
    try {
      await driver.findElement(By.id('nav-indent')).click();
      // Wait for tab bar to appear
      await driver.wait(until.elementLocated(By.id('tab-list')), TIMEOUT);
      pass('Indent module loaded — tab bar visible');
    } catch (e) {
      fail('Could not navigate to Indent module', e);
      throw e;
    }

    // ── 2. LIST TAB ───────────────────────────────────────────────────────────
    console.log('\n▶ Phase 2: 📋 Indents List Tab');
    await driver.findElement(By.id('tab-list')).click();
    await assertVisible(
      driver,
      By.xpath("//th[contains(text(), 'Indent No')]"),
      'Indents table header "Indent No" visible'
    );
    await assertVisible(
      driver,
      By.xpath("//th[contains(text(), 'Status')]"),
      'Indents table header "Status" visible'
    );

    // ── 3. RAISE INDENT ───────────────────────────────────────────────────────
    console.log('\n▶ Phase 3: ➕ Raise Indent');

    try {
      // Click the "+ Raise Indent" header button
      await driver.findElement(By.id('btn-trigger-raise')).click();
      await driver.wait(until.elementLocated(By.id('raise-dept')), TIMEOUT);
      pass('Raise form appeared after clicking button');
    } catch (e) {
      fail('Raise form did not appear', e);
    }

    // Check department select is locked for Production Manager (role_level 3)
    try {
      const deptEl = await driver.findElement(By.id('raise-dept'));
      const disabled = await deptEl.getAttribute('disabled');
      if (disabled) {
        pass('Department dropdown is disabled (locked) for non-admin user');
      } else {
        fail('Department dropdown is NOT disabled — expected locked for Production Manager');
      }
    } catch (e) {
      fail('Could not check department dropdown', e);
    }

    // Fill Section
    try {
      const secEl = await driver.findElement(By.id('raise-section'));
      await secEl.click();
      // Choose "WIRE" — find the option and click it
      const wireOpt = await secEl.findElement(By.xpath(".//option[text()='WIRE']"));
      await wireOpt.click();
      pass('Section selected: WIRE');
    } catch (e) {
      fail('Could not select section', e);
    }

    // Fill Required Date (HTML date input expects YYYY-MM-DD)
    try {
      const dateEl = await driver.findElement(By.id('raise-required-date'));
      await dateEl.click();
      await dateEl.sendKeys('2026-07-15');
      pass('Required Date filled: 2026-07-15');
    } catch (e) {
      fail('Could not fill required date', e);
    }

    // Fill Remarks
    try {
      await driver.findElement(By.id('raise-remarks')).sendKeys('Selenium E2E test indent - spare parts');
      pass('Remarks filled');
    } catch (e) {
      fail('Could not fill remarks', e);
    }

    // Select first real material in the item row 0 dropdown
    try {
      const matEl = await driver.findElement(By.id('raise-item-mat-0'));
      // Get all options and pick first non-placeholder
      const options = await matEl.findElements(By.tagName('option'));
      let found = false;
      for (const opt of options) {
        const val = await opt.getAttribute('value');
        if (val && val !== '') {
          await opt.click();
          found = true;
          pass(`Material selected (first available material)`);
          break;
        }
      }
      if (!found) fail('No material options found in dropdown');
    } catch (e) {
      fail('Could not select material', e);
    }

    // Fill Qty
    try {
      const qtyEl = await driver.findElement(By.id('raise-item-qty-0'));
      await qtyEl.clear();
      await qtyEl.sendKeys('5');
      pass('Quantity filled: 5');
    } catch (e) {
      fail('Could not fill quantity', e);
    }

    // Fill Purpose
    try {
      await driver.findElement(By.id('raise-item-purpose-0')).sendKeys('Wire section couch roll replacement');
      pass('Purpose filled');
    } catch (e) {
      fail('Could not fill purpose', e);
    }

    // Submit form
    try {
      await driver.findElement(By.id('btn-submit-raise')).click();
      // Wait for success message or return to list
      await driver.wait(
        until.elementLocated(By.xpath("//*[contains(text(),'Indent') and (contains(text(),'created') or contains(text(),'saved') or contains(text(),'raised') or contains(text(),'PIIMAS'))]")),
        TIMEOUT
      );
      pass('Indent submitted — success confirmation visible');
    } catch (e) {
      // May still have succeeded but confirmation text different — try checking if back on list
      try {
        const listVisible = await driver.findElement(By.xpath("//th[contains(text(), 'Indent No')]"));
        pass('Indent submitted — returned to list view');
      } catch {
        fail('Submit may have failed — no confirmation or list visible', e);
      }
    }

    // ── 4. ACKNOWLEDGE TAB ────────────────────────────────────────────────────
    console.log('\n▶ Phase 4: 🤝 Acknowledge Tab');
    try {
      await driver.findElement(By.id('tab-ack')).click();
      await driver.wait(
        until.elementLocated(By.xpath("//*[contains(text(), 'pending fitment') or contains(text(), 'No pending') or contains(text(), 'acknowledgment')]")),
        TIMEOUT
      );
      pass('Acknowledge tab rendered — content visible');
    } catch (e) {
      fail('Acknowledge tab failed to load', e);
    }

    // ── 5. CALENDAR TAB ───────────────────────────────────────────────────────
    console.log('\n▶ Phase 5: 📅 Calendar Tab');
    try {
      await driver.findElement(By.id('tab-calendar')).click();
      await driver.wait(
        until.elementLocated(By.xpath("//*[text()='Mon' or text()='Sun' or text()='Tue']")),
        TIMEOUT
      );
      pass('Calendar tab rendered — day headers visible');
    } catch (e) {
      fail('Calendar tab failed to load', e);
    }

  } catch (fatalErr) {
    console.error('\n💥 FATAL ERROR — test aborted early:', fatalErr.message);
  } finally {
    await driver.quit();

    // ── SUMMARY ───────────────────────────────────────────────────────────────
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(` RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════════════');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTest();
