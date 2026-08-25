const path = require('path');
const xlsx = require('xlsx');

const fp = path.join(__dirname, '../../Projects_Requirement/8252026/Inward.xlsx');
const wb = xlsx.readFile(fp);
const ws = wb.Sheets['Sheet1'];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

const excelDateToJS = (serial) => {
  if (!serial) return '2026-08-01';
  if (typeof serial === 'string') {
    const cleaned = serial.replace(/\s+/g, '').replace(/\/0\//g, '/08/').replace(/\/\/+/g, '/');
    const parts = cleaned.split(/[\/\-]/).filter(Boolean);
    if (parts.length === 3) {
      let d, m, y;
      if (parts[0].length === 4) {
        y = parts[0]; m = parts[1]; d = parts[2];
      } else {
        d = parts[0]; m = parts[1]; y = parts[2];
        if (y.length === 2) y = '20' + y;
      }
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '2026-08-01';
  }
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().slice(0, 10);
};

let currentGroup = null;
const groups = [];

for (let i = 3; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length === 0 || r.every(cell => cell === null || cell === undefined || cell === '')) continue;
  
  const sno = r[0];
  const igrn = r[1];
  const dateRaw = r[2];
  const itemCode = r[3];
  const itemName = r[4];
  const hsn = r[5];
  const uom = r[6];
  const qty = r[7];
  const price = r[8];
  const discount1 = r[9];
  const subTotal = r[10];
  const discount2 = r[11];
  const afterDiscount = r[12];
  const cgst9 = r[13];
  const cgst2_5 = r[14];
  const sgst9 = r[15];
  const sgst2_5 = r[16];
  const igst = r[17];
  const taxVal = r[18];
  const lineTotal = r[19];
  const invoiceTotal = r[20];
  const party = r[21];
  const invoiceNo = r[22];
  const invoiceDateRaw = r[23];
  const transporter = r[24];
  const lrNo = r[25];
  const creditOrCash = r[26];

  const hasNewHeader = (sno !== null && sno !== undefined && sno !== '') || (igrn && igrn.toString().trim() !== '');

  if (hasNewHeader) {
    if (currentGroup) groups.push(currentGroup);
    currentGroup = {
      startRow: i,
      sno: sno,
      igrn: igrn ? igrn.toString().trim() : '',
      dateRaw: dateRaw,
      date: excelDateToJS(dateRaw),
      party: party ? party.toString().trim() : '',
      invoiceNo: invoiceNo ? invoiceNo.toString().trim() : '',
      invoiceDateRaw: invoiceDateRaw,
      invoiceDate: invoiceDateRaw ? excelDateToJS(invoiceDateRaw) : excelDateToJS(dateRaw),
      transporter: transporter ? transporter.toString().trim() : '',
      lrNo: lrNo ? lrNo.toString().trim() : '',
      creditOrCash: creditOrCash ? creditOrCash.toString().trim() : '',
      invoiceTotal: invoiceTotal !== undefined && invoiceTotal !== null ? parseFloat(invoiceTotal) : null,
      items: []
    };
  }

  if (currentGroup) {
    if (party && !currentGroup.party) currentGroup.party = party.toString().trim();
    if (invoiceNo && !currentGroup.invoiceNo) currentGroup.invoiceNo = invoiceNo.toString().trim();
    if (invoiceDateRaw && !currentGroup.invoiceDateRaw) {
      currentGroup.invoiceDateRaw = invoiceDateRaw;
      currentGroup.invoiceDate = excelDateToJS(invoiceDateRaw);
    }
    if (transporter && !currentGroup.transporter) currentGroup.transporter = transporter.toString().trim();
    if (lrNo && !currentGroup.lrNo) currentGroup.lrNo = lrNo.toString().trim();
    if (creditOrCash && !currentGroup.creditOrCash) currentGroup.creditOrCash = creditOrCash.toString().trim();
    if (invoiceTotal !== undefined && invoiceTotal !== null && currentGroup.invoiceTotal === null) {
      currentGroup.invoiceTotal = parseFloat(invoiceTotal);
    }

    if (itemCode || itemName) {
      const q = parseFloat(qty || 0);
      const p = parseFloat(price || 0);
      const disc = parseFloat(discount1 || discount2 || 0);
      const sub = parseFloat(subTotal || (q * p));
      const afterDisc = parseFloat(afterDiscount || (sub - disc) || sub);
      const cg = parseFloat(cgst9 || cgst2_5 || 0);
      const sg = parseFloat(sgst9 || sgst2_5 || 0);
      const ig = parseFloat(igst || 0);
      let tax = parseFloat(taxVal || 0);
      if (tax === 0 && (cg > 0 || sg > 0 || ig > 0)) {
        tax = cg + sg + ig;
      }
      let tot = parseFloat(lineTotal || (afterDisc + tax));

      // Calculate GST rate
      let gstPct = 0;
      if (cgst9 || sgst9) gstPct = 18;
      else if (cgst2_5 || sgst2_5) gstPct = 5;
      else if (ig > 0 && afterDisc > 0) {
        gstPct = Math.round((ig / afterDisc) * 100);
      } else if (tax > 0 && afterDisc > 0) {
        gstPct = Math.round((tax / afterDisc) * 100);
      }

      currentGroup.items.push({
        row: i,
        itemCode: itemCode ? itemCode.toString().trim() : null,
        itemName: itemName ? itemName.toString().trim() : (itemCode || 'Unnamed Item'),
        hsn: hsn ? hsn.toString().trim() : null,
        uom: uom ? uom.toString().trim().toUpperCase() : 'NOS',
        qty: q,
        price: p,
        discount: disc,
        subTotal: sub,
        afterDiscount: afterDisc,
        gstPct: gstPct,
        cgst: cg,
        sgst: sg,
        igst: ig,
        taxVal: tax,
        lineTotal: tot
      });
    }
  }
}
if (currentGroup) groups.push(currentGroup);

console.log(`Total Groups Parsed: ${groups.length}`);
let grandCalculated = 0;
groups.forEach((g, idx) => {
  const sumTaxable = g.items.reduce((s, it) => s + it.afterDiscount, 0);
  const sumTax = g.items.reduce((s, it) => s + it.taxVal, 0);
  const sumTotal = g.items.reduce((s, it) => s + it.lineTotal, 0);
  grandCalculated += sumTotal;
  console.log(`\nGroup #${idx + 1} [S.No ${g.sno}]: IGRN="${g.igrn}", Date=${g.date}, Party="${g.party.slice(0, 30)}", Inv="${g.invoiceNo}", InvDate=${g.invoiceDate}, Items=${g.items.length}`);
  console.log(`   Items Sum: Taxable=₹${sumTaxable.toFixed(2)}, Tax=₹${sumTax.toFixed(2)}, LineTotal=₹${sumTotal.toFixed(2)} | Excel InvTotal=${g.invoiceTotal}`);
});
console.log(`\nTOTAL INWARD VALUE OF ALL 26 GROUPS: ₹${grandCalculated.toFixed(2)}`);
