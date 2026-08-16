// Fail-safe Kafka producer. NEVER throws, NEVER blocks a request — if the broker
// is down the publish is silently dropped so the ERP keeps working regardless.
// Enable/disable with KAFKA_ENABLED (default on); brokers via KAFKA_BROKERS.
const { Kafka, logLevel } = require('kafkajs');

const ENABLED = process.env.KAFKA_ENABLED !== 'false';
const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map(s => s.trim());

const kafka = new Kafka({
  clientId: 'mk-paper-mill',
  brokers: BROKERS,
  logLevel: logLevel.NOTHING,
  retry: { retries: 2, initialRetryTime: 300 },
});

let producer = null, ready = false, connecting = null;

async function ensure() {
  if (!ENABLED || ready) return ready;
  if (!connecting) {
    producer = kafka.producer();
    connecting = producer.connect()
      .then(() => { ready = true; })
      .catch(() => { ready = false; connecting = null; });
  }
  await connecting;
  return ready;
}

// Fire-and-forget event publish. Resolves silently even on failure.
async function publish(topic, key, value) {
  if (!ENABLED) return false;
  try {
    if (!(await ensure())) return false;
    await producer.send({ topic, messages: [{ key: String(key), value: JSON.stringify(value) }] });
    return true;
  } catch (_) {
    ready = false; connecting = null; // force reconnect next time
    return false;
  }
}

module.exports = {
  publish,
  TOPICS: {
    DPR:         'mkpm.dpr.events',
    EVENTS_CRIT: 'mkpm.events.critical',
    EVENTS_ALL:  'mkpm.events.all',
    TELEMETRY:   'mkpm.telemetry.readings',
    LAB:         'mkpm.quality.lab',
    CORRELATION: 'mkpm.analysis.correlation',
  }
};
