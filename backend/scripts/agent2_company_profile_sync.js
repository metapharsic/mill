const pool = require('../src/db/pool');

const companySettings = [
  { key: 'COMPANY_NAME', label: 'Company Name', value: 'SRI M.K. PAPER MILLS PRIVATE LIMITED' },
  { key: 'COMPANY_SUBTITLE', label: 'Company Subtitle (Tagline)', value: 'MANUFACTURERS OF KRAFT & FLUTING PAPER' },
  { key: 'COMPANY_ADDRESS', label: 'Registered Address', value: 'Survey No. 42/1, Mill Road, Industrial Area, Karnataka, India' },
  { key: 'COMPANY_GSTIN', label: 'GSTIN Number', value: '29AABCS1429B1Z8' },
  { key: 'COMPANY_PHONE', label: 'Contact Phone', value: '+91 99855 89599' },
  { key: 'COMPANY_DL_NO', label: 'D.L. No. / Factory License', value: 'KA/MDL/2026-147387' },
  { key: 'COMPANY_PAN', label: 'PAN Number', value: 'AAICM7429L' },
  { key: 'COMPANY_STATE', label: 'State Name', value: 'Karnataka' },
  { key: 'COMPANY_STATE_CODE', label: 'State Code', value: '29' },
  { key: 'COMPANY_BANK_NAME', label: 'Bank Name', value: 'HDFC Bank Ltd.' },
  { key: 'COMPANY_BANK_AC', label: 'Bank A/C Number', value: '50200067891234' },
  { key: 'COMPANY_BANK_IFSC', label: 'Bank IFSC Code', value: 'HDFC0001234' },
  { key: 'COMPANY_BANK_BRANCH', label: 'Bank Branch', value: 'Main Branch, Hubli' },
  { key: 'COMPANY_JURISDICTION', label: 'Legal Jurisdiction', value: 'Hyderabad' }
];

async function run() {
  console.log('🤖 Agent 1: Seeding Company Profile settings...');
  let inserted = 0;
  for (const s of companySettings) {
    const res = await pool.query(
      `INSERT INTO system_settings (key, value, category, label, updated_at) 
       VALUES ($1, $2, 'Company Profile', $3, NOW())
       ON CONFLICT (key) DO NOTHING RETURNING id`,
      [s.key, s.value, s.label]
    );
    if (res.rowCount > 0) inserted++;
  }
  console.log(`✅ Seeded ${inserted} new Company Profile keys.`);
  process.exit(0);
}

run().catch(e => {
  console.error('❌ Error seeding company profile:', e);
  process.exit(1);
});
