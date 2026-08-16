/**
 * SCADA Telemetry Collector Daemon (Ph25-B Mock Simulator)
 * 
 * Simulates direct Modbus/OPC UA connection to shop-floor PLCs.
 * Reads tag parameters and POSTs to ERP Telemetry API every 15 seconds.
 * Auto-authenticates and handles token expirations.
 */

const http = require('http');

// Configuration
const ERP_HOST = 'localhost';
const ERP_PORT = 5000;
const POLL_INTERVAL_MS = 15000;

const USER_EMAIL = 'head.prod@mkpapermill.com';
const USER_PASS = 'Test@1234';

let jwtToken = null;

// Helper: Post HTTP requests natively (no external deps)
function makeRequest(path, method, payload, token = null) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(payload);
    
    const options = {
      hostname: ERP_HOST,
      port: ERP_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr)
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ success: true, raw: body });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(dataStr);
    req.end();
  });
}

// Authenticate and fetch token
async function authenticate() {
  try {
    console.log(`[SCADA] Authenticating as ${USER_EMAIL}...`);
    const res = await makeRequest('/api/auth/login', 'POST', {
      email: USER_EMAIL,
      password: USER_PASS
    });
    jwtToken = res.token;
    console.log('[SCADA] Login successful, token acquired ✓');
  } catch (err) {
    console.error('[SCADA] Authentication failed:', err.message);
    jwtToken = null;
  }
}

// Mock sensor tag values generator
function readSensors() {
  return [
    {
      sectionId: 11, // Wire Section
      equipmentId: 3, // Forming Fabric
      tagName: 'PM1_WIRE_VAC_P1',
      parameterName: 'Wire Suction Box Vacuum',
      value: Number((18.5 + Math.random() * 4).toFixed(2)), // 18.5 to 22.5 kPa
      uom: 'kPa'
    },
    {
      sectionId: 13, // Press Part
      equipmentId: 5, // Shoe Press Roll
      tagName: 'PM1_PRESS_NIP_LOAD',
      parameterName: 'Press Roll Nip Load',
      value: Number((480 + Math.random() * 40).toFixed(1)), // 480 to 520 kN/m
      uom: 'kN/m'
    },
    {
      sectionId: 15, // Pre Dryer Part
      equipmentId: 6, // Dryer Steam Group 2
      tagName: 'PM1_DRYER_STEAM_PRES',
      parameterName: 'Dryer Steam Pressure',
      value: Number((3.2 + Math.random() * 0.8).toFixed(2)), // 3.2 to 4.0 bar
      uom: 'bar'
    }
  ];
}

// Telemetry collection loop
async function collectionCycle() {
  if (!jwtToken) {
    await authenticate();
    if (!jwtToken) return; // skip if login failed
  }

  const sensors = readSensors();
  console.log(`\n[SCADA] Beginning sensor poll cycle (${new Date().toLocaleTimeString()})...`);

  for (const tag of sensors) {
    try {
      const res = await makeRequest('/api/telemetry', 'POST', tag, jwtToken);
      if (res.success) {
        console.log(`  ✓ Transmitted Tag: ${tag.tagName} = ${tag.value} ${tag.uom}`);
      }
    } catch (err) {
      console.error(`  ❌ Failed Tag: ${tag.tagName} - ${err.message}`);
      
      // If unauthorized, token expired
      if (err.message.includes('401') || err.message.includes('403')) {
        console.log('[SCADA] Token invalid or expired. Forcing re-login next cycle.');
        jwtToken = null;
        break;
      }
    }
  }
}

// Start daemon
async function startDaemon() {
  console.log('============================================================');
  console.log('🚀 SCADA Telemetry Collector Daemon Mock Simulator Active');
  console.log(`ERP target endpoint: http://${ERP_HOST}:${ERP_PORT}`);
  console.log(`Polling interval: ${POLL_INTERVAL_MS / 1000} seconds`);
  console.log('============================================================');

  // Initial call
  await collectionCycle();

  // Schedule intervals
  setInterval(collectionCycle, POLL_INTERVAL_MS);
}

startDaemon().catch(err => {
  console.error('Fatal SCADA Daemon failure:', err.message);
  process.exit(1);
});
