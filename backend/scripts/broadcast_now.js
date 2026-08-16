// BROADCAST NOW — send one test message to every deep analysis Kafka topic
const { Kafka, logLevel } = require('kafkajs');

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map(s => s.trim());
const kafka = new Kafka({ clientId: 'mk-broadcast-now', brokers, logLevel: logLevel.NOTHING });
const producer = kafka.producer();

const now = new Date().toISOString();
const messages = [
  {
    topic: 'mkpm.dpr.events',
    payload: { dprId: 999, date: now.slice(0, 10), reportedBy: 'broadcast-test', note: 'Manual broadcast test' }
  },
  {
    topic: 'mkpm.telemetry.readings',
    payload: { id: 9901, sectionId: 1, tagName: 'WIRE-VAC-P1', parameterName: 'Wire Vacuum P1', value: 3.2, uom: 'kPa', readingTime: now, source: 'Manual', recordedBy: 1 }
  },
  {
    topic: 'mkpm.telemetry.readings',
    payload: { id: 9902, sectionId: 3, tagName: 'PRESS-NIP-1', parameterName: 'Press Nip Load', value: 85.4, uom: 'kN/m', readingTime: now, source: 'Manual', recordedBy: 1 }
  },
  {
    topic: 'mkpm.telemetry.readings',
    payload: { id: 9903, sectionId: 7, tagName: 'DRYER-STM-G1', parameterName: 'Dryer Steam Group 1', value: 3.8, uom: 'bar', readingTime: now, source: 'SCADA', recordedBy: 1 }
  },
  {
    topic: 'mkpm.quality.lab',
    payload: { id: 9901, reelId: 1, sectionId: 1, testTime: now, freeness_csf: 410, basisWeightGsm: 80.0, burstFactor: 22, moisturePct: 6.1, dirtCount: 0.4, labBy: 1 }
  },
  {
    topic: 'mkpm.events.all',
    payload: { eventId: 9901, eventType: 'roll_change', sectionId: 3, severity: 'Warning', eventTime: now, description: 'Felt roll #2 replaced after 30 days run', locationDetail: 'Press section felt #2', reportedBy: 1 }
  },
  {
    topic: 'mkpm.events.all',
    payload: { eventId: 9902, eventType: 'paper_break', sectionId: 1, severity: 'Critical', eventTime: now, description: 'Paper break at wire P3 vacuum zone', locationDetail: 'Wire section P3', reportedBy: 1 }
  },
  {
    topic: 'mkpm.events.critical',
    payload: { eventId: 9902, eventType: 'paper_break', sectionId: 1, severity: 'Critical', eventTime: now, description: 'Paper break at wire P3 vacuum zone', locationDetail: 'Wire section P3', reportedBy: 1 }
  },
  {
    topic: 'mkpm.analysis.correlation',
    payload: { sectionId: 1, windowHours: 24, correlationCount: 2, computedAt: now, sample: [{ labId: 1, freeness_csf: 410, vacuumAvg: 3.15 }, { labId: 2, freeness_csf: 390, vacuumAvg: 3.60 }] }
  },
];

async function run() {
  console.log('🔌 Connecting to Kafka broker...');
  await producer.connect();
  console.log('✅ Connected!\n🚀 Broadcasting to all topics...\n');

  for (const m of messages) {
    await producer.send({
      topic: m.topic,
      messages: [{ key: String(m.payload.id || m.payload.eventId || m.payload.dprId || 'test'), value: JSON.stringify(m.payload) }]
    });
    console.log(`  📡 SENT → ${m.topic}`);
    console.log(`         payload: ${JSON.stringify(m.payload).slice(0, 100)}...`);
  }

  console.log('\n✅ All broadcasts done!');

  // Read back from each topic to confirm
  console.log('\n📥 Consuming latest message from each topic...\n');
  await producer.disconnect();

  const consumer = kafka.consumer({ groupId: 'broadcast-verify-' + Date.now() });
  await consumer.connect();

  const topicSet = [...new Set(messages.map(m => m.topic))];
  await consumer.subscribe({ topics: topicSet, fromBeginning: false });

  const seen = new Set();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 4000);
    consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!seen.has(topic)) {
          seen.add(topic);
          const val = JSON.parse(message.value.toString());
          console.log(`  ✅ RECV ← ${topic}`);
          console.log(`         msg: ${JSON.stringify(val).slice(0, 100)}...`);
          if (seen.size === topicSet.length) { clearTimeout(timeout); resolve(); }
        }
      }
    });
  });

  console.log(`\n🎯 Broadcast verified: ${seen.size}/${topicSet.length} topics confirmed.`);
  await consumer.disconnect();
  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
