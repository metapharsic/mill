const fs = require('fs');
const path = require('path');

// Look for Logo.png first, fallback to skmill.jpeg
let logoPath = path.join(__dirname, '../logo/Logo.png');
let mimeType = 'image/png';
let ext = '.png';

if (!fs.existsSync(logoPath)) {
  logoPath = path.join(__dirname, '../logo/skmill.jpeg');
  mimeType = 'image/jpeg';
  ext = '.jpeg';
}

console.log('Using logo source:', logoPath);

const targetUtilPath = path.join(__dirname, '../frontend/src/utils/logo.js');
const pubLogoPng = path.join(__dirname, '../frontend/public/logo.png');
const pubLogoJpg = path.join(__dirname, '../frontend/public/logo.jpg');
const pubLogoSrc = path.join(__dirname, '../frontend/public/Logo.png');
const srcLogoPng = path.join(__dirname, '../frontend/src/assets/logo.png');
const srcLogoDir = path.dirname(srcLogoPng);
const pubDir = path.dirname(pubLogoPng);

if (!fs.existsSync(srcLogoDir)) fs.mkdirSync(srcLogoDir, { recursive: true });
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

const buf = fs.readFileSync(logoPath);
fs.writeFileSync(pubLogoPng, buf);
fs.writeFileSync(pubLogoJpg, buf);
fs.writeFileSync(pubLogoSrc, buf);
fs.writeFileSync(srcLogoPng, buf);

const b64 = buf.toString('base64');
const dataUri = `data:${mimeType};base64,${b64}`;

const content = `// Official SRI M.K. Paper Mills Logo Asset Utility
export const LOGO_DATA_URI = ${JSON.stringify(dataUri)};
export const LOGO_SRC = '/logo.png';
export const LOGO_ALT = 'Sri M K Paper Mills';
export default LOGO_DATA_URI;
`;

fs.writeFileSync(targetUtilPath, content, 'utf8');
console.log('Successfully deployed official Sri M K Paper Mills logo and generated frontend/src/utils/logo.js');

