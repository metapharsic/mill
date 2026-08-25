const path = require('path');
const xlsx = require('xlsx');

const fp = path.join(__dirname, '../../Projects_Requirement/8252026/Inward.xlsx');
const wb = xlsx.readFile(fp);
const ws = wb.Sheets['Sheet1'];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

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

  if ((sno !== null && sno !== undefined && sno !== '') || (igrn && igrn.toString().trim() !== '')) {
    if (currentGroup) groups.push(currentGroup);
    currentGroup = {
      startRow: i,
      sno: sno,
      igrn: igrn ? igrn.toString().trim() : '',
      dateRaw: dateRaw,
      party: party ? party.toString().trim() : '',
      invoiceNo: invoiceNo ? invoiceNo.toString().trim() : '',
      invoiceDateRaw: invoiceDateRaw,
      transporter: transporter ? transporter.toString().trim() : '',
      lrNo: lrNo ? lrNo.toString().trim() : '',
      creditOrCash: creditOrCash ? creditOrCash.toString().trim() : '',
      invoiceTotal: invoiceTotal,
      items: []
    };
  }

  if (currentGroup) {
    if (party && !currentGroup.party) currentGroup.party = party.toString().trim();
    if (invoiceNo && !currentGroup.invoiceNo) currentGroup.invoiceNo = invoiceNo.toString().trim();
    if (invoiceDateRaw && !currentGroup.invoiceDateRaw) currentGroup.invoiceDateRaw = invoiceDateRaw;
    if (transporter && !currentGroup.transporter) currentGroup.transporter = transporter.toString().trim();
    if (lrNo && !currentGroup.lrNo) currentGroup.lrNo = lrNo.toString().trim();
    if (creditOrCash && !currentGroup.creditOrCash) currentGroup.creditOrCash = creditOrCash.toString().trim();
    if (invoiceTotal && !currentGroup.invoiceTotal) currentGroup.invoiceTotal = invoiceTotal;

    if (itemCode || itemName) {
      currentGroup.items.push({
        row: i,
        itemCode: itemCode ? itemCode.toString().trim() : null,
        itemName: itemName ? itemName.toString().trim() : null,
        hsn: hsn ? hsn.toString().trim() : null,
        uom: uom ? uom.toString().trim() : 'NOS',
        qty: parseFloat(qty || 0),
        price: parseFloat(price || 0),
        discount: parseFloat(discount1 || discount2 || 0),
        subTotal: parseFloat(subTotal || 0),
        afterDiscount: parseFloat(afterDiscount || subTotal || (qty * price) || 0),
        cgst: parseFloat(cgst9 || cgst2_5 || 0),
        sgst: parseFloat(sgst9 || sgst2_5 || 0),
        igst: parseFloat(igst || 0),
        taxVal: parseFloat(taxVal || 0),
        lineTotal: parseFloat(lineTotal || 0)
      });
    }
  }
}
if (currentGroup) groups.push(currentGroup);

console.log('GROUPS 1 to 12:');
groups.slice(0, 12).forEach((g, idx) => {
  console.log(`[#${idx + 1}] S.No: ${g.sno}, IGRN: "${g.igrn}", Date: ${g.dateRaw}, Party: "${g.party}", Inv: "${g.invoiceNo}", InvTotal: ${g.invoiceTotal}, Items: ${g.items.length}`);
  g.items.forEach((it, itIdx) => {
    console.log(`   - [${it.itemCode}] ${it.itemName} | Qty: ${it.qty} ${it.uom} | Price: ${it.price} | Taxable: ${it.afterDiscount} | Tax: ${it.taxVal} | Total: ${it.lineTotal}`);
  });
});
