#!/usr/bin/env node
/**
 * Observability & streaming stack status — Kafka / Prometheus / Grafana / backend.
 * Usage: node scripts/stack-status.js
 */
const net = require('net');
const http = require('http');

const checkPort = (port, host = 'localhost', timeout = 1500) =>
  new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeout);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => { resolve(false); });
    s.connect(port, host);
  });

const httpBody = (url, timeout = 2000) =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(d));
    });
    req.setTimeout(timeout, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });

(async () => {
  const rows = [
    ['Kafka broker', 9092], ['Kafka controller', 9093],
    ['Prometheus', 9090], ['Grafana', 3000], ['MK backend', 5000],
  ];
  console.log('Component            Port   Status');
  console.log('-------------------- -----  ------');
  for (const [name, port] of rows) {
    const up = await checkPort(port);
    console.log(`${name.padEnd(20)} ${String(port).padEnd(6)} ${up ? 'UP' : 'DOWN'}`);
  }

  // deeper checks
  const targets = await httpBody('http://localhost:9090/api/v1/targets?state=active');
  if (targets) {
    const mkUp = /"job":"mk_paper_mill_backend"[^}]*"health":"up"|"health":"up"[^}]*"job":"mk_paper_mill_backend"/.test(targets)
      || (targets.includes('mk_paper_mill_backend') && targets.includes('"health":"up"'));
    console.log(`\nPrometheus scraping MK backend: ${targets.includes('mk_paper_mill_backend') ? (mkUp ? 'UP' : 'registered') : 'MISSING'}`);
  }
  const metrics = await httpBody('http://localhost:5000/metrics');
  console.log(`MK /metrics exposed: ${metrics && metrics.includes('mkpm_') ? 'yes' : 'no'}`);
  const gh = await httpBody('http://localhost:3000/api/health');
  console.log(`Grafana health: ${gh ? (JSON.parse(gh).database || '?') : 'unreachable'}`);
  console.log('\nGrafana dashboard: http://localhost:3000/d/mkpm-overview  (admin/admin)');
})();
