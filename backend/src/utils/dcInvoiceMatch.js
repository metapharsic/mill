// Pure helper functions for the Inbound DC -> Invoice Match reconciliation flow.
function computeLineValue(qty, unitPrice, discountPct, taxAmount) {
  const q = Number(qty) || 0;
  const rate = Number(unitPrice) || 0;
  const disc = Math.max(0, Math.min(100, Number(discountPct) || 0));
  const tax = Number(taxAmount) || 0;
  const taxableValue = q * rate * (1 - disc / 100);
  const totalValue = taxableValue + tax;
  const gstPct = taxableValue > 0 ? Number(((tax / taxableValue) * 100).toFixed(2)) : 0;
  return { taxableValue, totalValue, gstPct };
}

function computeSelectedTotal(lines) {
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((sum, line) => {
    const { totalValue } = computeLineValue(line.qty, line.unit_price, line.discount_pct, line.gst_amount);
    return sum + totalValue;
  }, 0);
}

function compareToInvoiceTotal(computedTotal, invoiceTotal, tolerance = 1) {
  if (invoiceTotal === '' || invoiceTotal === null || invoiceTotal === undefined) {
    return { comparable: false, isMatch: false, diff: null };
  }
  const computed = Number(computedTotal) || 0;
  const invoice = Number(invoiceTotal) || 0;
  const diff = Math.abs(computed - invoice);
  return { comparable: true, isMatch: diff < tolerance, diff };
}

module.exports = { computeLineValue, computeSelectedTotal, compareToInvoiceTotal };
