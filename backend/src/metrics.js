// Prometheus metrics — scraped by Prometheus at GET /metrics.
// Default process/node metrics + per-route HTTP counters & latency histogram.
const client = require('prom-client');

const register = new client.Registry();
register.setDefaultLabels({ app: 'mk_paper_mill' });
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'mkpm_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: 'mkpm_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Business gauge — latest daily PM/C production (MT). Set by production route on save.
const dprProduction = new client.Gauge({
  name: 'mkpm_dpr_pmc_production_mt',
  help: 'Latest saved Daily Production Report PM/C production (MT)',
  labelNames: ['machine'],
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = (req.baseUrl || '') + ((req.route && req.route.path) || req.path || 'unknown');
    const labels = { method: req.method, route, status: res.statusCode };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
}

module.exports = { register, metricsMiddleware, metrics: { dprProduction } };
