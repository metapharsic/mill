// Unit tests for backend/src/utils/dcInvoiceMatch.js
//
// Plain Node `assert` + a tiny inline runner -- this repo has no jest/mocha/
// vitest dependency installed anywhere (checked backend/package.json and
// root package.json before writing this), and every other backend
// "test_*.js" script under backend/scripts/ follows this same
// print-PASS/FAIL-and-process.exit(1)-on-failure convention rather than a
// framework, so this matches existing repo style instead of introducing a
// new dependency for a handful of pure-function assertions.
//
// Run: node backend/scripts/test_dc_invoice_match_unit.js

const assert = require('assert');
const {
  computeLineValue,
  computeSelectedTotal,
  compareToInvoiceTotal
} = require('../src/utils/dcInvoiceMatch');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
  }
}

console.log('Inbound DC / Invoice Match — unit tests');
console.log('========================================');

test('computeLineValue: no discount, no tax', () => {
  const r = computeLineValue(10, 100, 0, 0);
  assert.strictEqual(r.taxableValue, 1000);
  assert.strictEqual(r.totalValue, 1000);
  assert.strictEqual(r.gstPct, 0);
});

test('computeLineValue: qty * rate with discount % applied', () => {
  const r = computeLineValue(10, 100, 10, 0); // 1000 - 10% = 900
  assert.strictEqual(r.taxableValue, 900);
  assert.strictEqual(r.totalValue, 900);
});

test('computeLineValue: tax amount added on top of taxable value', () => {
  const r = computeLineValue(10, 100, 10, 162); // 900 taxable + 162 tax = 1062 (18% GST)
  assert.strictEqual(r.taxableValue, 900);
  assert.strictEqual(r.totalValue, 1062);
  assert.strictEqual(r.gstPct, 18);
});

test('computeLineValue: discount_pct clamped to [0,100]', () => {
  const over = computeLineValue(10, 100, 150, 0);
  assert.strictEqual(over.taxableValue, 0); // clamped to 100% off
  const under = computeLineValue(10, 100, -20, 0);
  assert.strictEqual(under.taxableValue, 1000); // clamped to 0% off
});

test('computeLineValue: non-numeric / missing inputs default to 0, not NaN', () => {
  const r = computeLineValue(undefined, 'abc', null, '');
  assert.strictEqual(r.taxableValue, 0);
  assert.strictEqual(r.totalValue, 0);
  assert.strictEqual(r.gstPct, 0);
  assert.ok(!Number.isNaN(r.taxableValue));
});

test('computeLineValue: string-typed numeric inputs (as sent by HTML number inputs / JSON)', () => {
  const r = computeLineValue('10', '100', '10', '162');
  assert.strictEqual(r.taxableValue, 900);
  assert.strictEqual(r.totalValue, 1062);
});

test('computeSelectedTotal: sums totalValue across multiple ticked lines', () => {
  const lines = [
    { qty: 10, unit_price: 100, discount_pct: 0, gst_amount: 180 },  // 1000 + 180 = 1180
    { qty: 5, unit_price: 50, discount_pct: 10, gst_amount: 20.25 } // 225 + 20.25 = 245.25
  ];
  const total = computeSelectedTotal(lines);
  assert.ok(Math.abs(total - 1425.25) < 1e-9, `expected ~1425.25, got ${total}`);
});

test('computeSelectedTotal: empty / non-array input returns 0', () => {
  assert.strictEqual(computeSelectedTotal([]), 0);
  assert.strictEqual(computeSelectedTotal(null), 0);
  assert.strictEqual(computeSelectedTotal(undefined), 0);
});

test('compareToInvoiceTotal: not comparable when invoice total is blank/unset', () => {
  const r1 = compareToInvoiceTotal(1000, '');
  const r2 = compareToInvoiceTotal(1000, null);
  const r3 = compareToInvoiceTotal(1000, undefined);
  assert.strictEqual(r1.comparable, false);
  assert.strictEqual(r2.comparable, false);
  assert.strictEqual(r3.comparable, false);
});

test('compareToInvoiceTotal: exact match', () => {
  const r = compareToInvoiceTotal(1180, 1180);
  assert.strictEqual(r.comparable, true);
  assert.strictEqual(r.isMatch, true);
  assert.strictEqual(r.diff, 0);
});

test('compareToInvoiceTotal: within tolerance (rounding noise) still counts as match', () => {
  const r = compareToInvoiceTotal(1180.6, 1180);
  assert.strictEqual(r.isMatch, true); // diff 0.6 < default tolerance 1
});

test('compareToInvoiceTotal: outside tolerance is a mismatch (green/red indicator logic)', () => {
  const r = compareToInvoiceTotal(1180, 1250);
  assert.strictEqual(r.comparable, true);
  assert.strictEqual(r.isMatch, false);
  assert.strictEqual(r.diff, 70);
});

test('compareToInvoiceTotal: custom tolerance respected', () => {
  const r = compareToInvoiceTotal(1005, 1000, 10);
  assert.strictEqual(r.isMatch, true);
});

console.log('========================================');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
