# Apache Kafka

- **Version:** 3.9.0 (Scala 2.13), **KRaft mode** — no ZooKeeper
- **Home:** `C:\infra\kafka`
- **Broker port:** `9092` (PLAINTEXT) · **Controller port:** `9093`
- **Data (log.dirs):** `C:/infra/kafka/data`
- **JDK:** `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot` (set `JAVA_HOME`)
- **Managed by:** `C:\infra\watchdog.ps1` (relaunches if 9092 dies)
- **Shared** with the Kapila project — do not delete topics blindly.

## Key `config/server.properties` settings

```
process.roles=broker,controller
node.id=1
controller.quorum.bootstrap.servers=localhost:9093
listeners=PLAINTEXT://:9092,CONTROLLER://:9093
advertised.listeners=PLAINTEXT://localhost:9092,CONTROLLER://localhost:9093
controller.listener.names=CONTROLLER
log.dirs=C:/infra/kafka/data
```

## Topics

| Topic | Owner | Purpose |
|-------|-------|---------|
| `mkpm.dpr.events` | MK Paper Mill | `dpr.saved` events from Daily Production Report |
| production-events, stock-events, purchase-order-events, supplier-events, indent-events, issuance-events, transfer-events, grn-events, leftover-events, recipe-events, rate-quote-events | Kapila (shared) | existing event streams |

## How to modify

- **Add a topic:**
  ```
  C:\infra\kafka\bin\windows\kafka-topics.bat --bootstrap-server localhost:9092 ^
    --create --topic mkpm.<name>.events --partitions 3 --replication-factor 1 --if-not-exists
  ```
  Prefix MK topics with `mkpm.` to keep them separate from Kapila.
- **List / describe:** `kafka-topics.bat --bootstrap-server localhost:9092 --list` / `--describe --topic <t>`
- **Consume (debug):** `kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic mkpm.dpr.events --from-beginning`
- **Producer in app:** `src/kafka.js` `publish(topic, key, value)` (fail-safe).

## Storage format (only when resetting the cluster)
```
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot
kafka-storage.bat random-uuid
kafka-storage.bat format -t <uuid> -c C:\infra\kafka\config\server.properties --standalone
```

## Recovery note
Corrupted `data\` dir on 2026-07-05 → preserved as `data_corrupt_20260705-162524`,
reformatted. Kafka data here is transient (source of truth = Postgres); topics
auto-recreate when apps reconnect. If broker crash-loops with
`log dir ... already offline`, reset the data dir (preserve the old one first).

## Change log
- 2026-07-05 — created topic `mkpm.dpr.events`; data dir reset + reformatted (KRaft).
