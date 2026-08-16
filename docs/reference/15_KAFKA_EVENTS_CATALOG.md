# MK Paper Mill ERP — Kafka Events Catalog

> **AI INSTRUCTION:** Read this before adding or editing any backend API mutations.
> You must publish matching events using `publish(topic, key, value)` when data states change,
> adhering to the fire-and-forget fail-safe architecture below.

---

## 1. Fail-Safe Event Architecture

Kafka event publishing is built to be completely **decoupled and fail-safe**. The ERP application does not depend on Kafka being online.

* **Design Pattern:** Fire-and-forget.
* **Error Handling:** All errors inside `publish()` are caught internally and logged/ignored. A down broker never blocks database transactions or HTTP responses.
* **Topic Constants:** Imported from `backend/src/kafka.js`.
* **Kafka Status Toggle:** Can be fully disabled by setting the environment variable `KAFKA_ENABLED=false`.

---

## 2. Topic Names & Reference

| Topic Key | Actual Topic Name | Purpose |
|---|---|---|
| `TOPICS.DPR` | `mkpm.dpr.events` | Daily Production Reports and summaries |
| `TOPICS.EVENTS_CRIT` | `mkpm.events.critical` | Critical actions (high-value stock issues, LTIs, breakdowns) |
| `TOPICS.EVENTS_ALL` | `mkpm.events.all` | General audit-level state changes (orders, schedules, logs) |
| `TOPICS.TELEMETRY` | `mkpm.telemetry.readings` | Real-time process telemetry from plant sections |
| `TOPICS.LAB` | `mkpm.quality.lab` | Laboratory sample logs and results |
| `TOPICS.CORRELATION` | `mkpm.analysis.correlation` | Process parameter correlation events |
| (Explicit string) | `mkpm.indent.events` | Multi-tier indent approvals and acknowledgments |
| (Explicit string) | `mkpm.telemetry.boiler` | Real-time boiler logs |
| (Explicit string) | `mkpm.telemetry.energy` | Real-time energy allocation logs |

---

## 3. Catalog of Published Events

### General Audit Events (`TOPICS.EVENTS_ALL`)

| Event Name | Key | Payload Fields | File & Line |
|---|---|---|---|
| `store.issue.created` | `issue-{id}` | `{ event, id, issueNumber, materialId, quantity, userId }` | [store.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/store.js#L82) |
| `store.issue.approved` | `issue-{id}` | `{ event, id, userId }` | [store.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/store.js#L153) |
| `store.issue.rejected` | `issue-{id}` | `{ event, id, userId }` | [store.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/store.js#L164) |
| `security.gatepass.created` | `gp-{id}` | `{ event, id, gpNumber, passType, vehicleNumber, userId }` | [security.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/security.js#L53) |
| `security.gatepass.closed` | `gp-{id}` | `{ event, id, userId }` | [security.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/security.js#L69) |
| `sales.order.created` | `so-{id}` | `{ event, id, soNumber, customerId, userId }` | [sales.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/sales.js#L67) |
| `sales.order.updated` | `so-{id}` | `{ event, id, status, userId }` | [sales.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/sales.js#L81) |
| `sales.order.confirmed` | `so-{id}` | `{ event, id, userId }` | [sales.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/sales.js#L105) |
| `customer.created` | `customer-{id}` | `{ event, id, code, name, gstin, userId, timestamp }` | [master.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/master.js#L253) |
| `customer.updated` | `customer-{id}` | `{ event, id, name, gstin, userId, timestamp }` | [master.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/master.js#L263) |
| `customer.deleted` | `customer-{id}` | `{ event, id, userId, timestamp }` | [master.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/master.js#L290) |
| `customer.restored` | `customer-{id}` | `{ event, id, userId, timestamp }` | [master.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/master.js#L329) |
| `section.updated` | `section-{id}` | `{ event, id, name, userId, timestamp }` | [master.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/master.js#L362) |
| `motor.created` | `motor-{id}` | `{ event, id, motor_name, section_label, userId, timestamp }` | [master.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/master.js#L400) |
| `motor.updated` | `motor-{id}` | `{ event, id, userId, timestamp }` | [master.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/master.js#L413) |
| `motor.deleted` | `motor-{id}` | `{ event, id, userId, timestamp }` | [master.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/master.js#L419) |
| `maintenance.schedule.created`| `schedule-{id}` | `{ event, id, title, userId, timestamp }` | [maintenance.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/maintenance.js#L61) |
| `maintenance.schedule.updated`| `schedule-{id}` | `{ event, id, title, userId, timestamp }` | [maintenance.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/maintenance.js#L75) |
| `maintenance.log.created` | `log-{id}` | `{ event, id, machine_id, userId, timestamp }` | [maintenance.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/maintenance.js#L197) |
| `equipment.created` | `equipment-{id}` | `{ event, id, name, userId, timestamp }` | [maintenance.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/maintenance.js#L295) |
| `equipment.updated` | `equipment-{id}` | `{ event, id, name, userId, timestamp }` | [maintenance.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/maintenance.js#L308) |
| `finance.payment.recorded` | `payment-{id}` | `{ event, id, paymentNumber, amount, soId, userId }` | [finance.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/finance.js#L136) |

### Critical Alert Events (`TOPICS.EVENTS_CRIT`)

| Event Name / Topic | Key | Payload Fields | File & Line |
|---|---|---|---|
| `maintenance.breakdown` | `machine-{id}` | `{ event, machine_id, description, userId, timestamp }` | [maintenance.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/maintenance.js#L270) |
| `stock.outward.high` / `stock.inward.high` | `stock-{id}` | `{ event, materialId, qty, value, shift, userId, timestamp }` | [inventory.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/inventory.js#L38) |
| `dpr.chemical.alert` | `chem-alert-{repId}-{cId}` | `{ event, reportId, reportDate, chemicalId, chemicalName, actualRate, stdRate, variancePct }` | [production.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/production.js#L1053) |

### Indent Management (`mkpm.indent.events`)

| Event Name | Key | Payload Fields | File & Line |
|---|---|---|---|
| `indent.created` | `{id}` | `{ event: 'indent.created', id, raiserId: user.id }` | [indent.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/indent.js#L81) |
| `indent.submitted` | `{id}` | `{ event: 'indent.submitted', id, userId }` | [indent.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/indent.js#L102) |
| `indent.approved_l1` | `{id}` | `{ event: 'indent.approved_l1', id, approverId }` | [indent.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/indent.js#L174) |
| `indent.approved` | `{id}` | `{ event: 'indent.approved', id, approverId }` | [indent.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/indent.js#L205) |
| `indent.rejected` | `{id}` | `{ event: 'indent.rejected', id, userId, reason }` | [indent.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/indent.js#L225) |
| `indent.issued` | `{id}` | `{ event: 'indent.issued', id, issuerId }` | [indent.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/indent.js#L249) |
| `indent.closed` | `{id}` | `{ event: 'indent.closed', id, userId }` | [indent.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/indent.js#L298) |
| `indent.item_acknowledged`| `{indent_id}` | `{ event: 'indent.item_acknowledged', itemId, indentId, ackBy }` | [indent.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/indent.js#L331) |

### Telemetry & Readings (`TOPICS.TELEMETRY` & Other Telemetry Topics)

| Topic | Key | Payload Fields | File & Line |
|---|---|---|---|
| `TOPICS.TELEMETRY` | `reading.id` | `{ reading_time, section_code, tag_name, value, unit }` | [telemetry.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/telemetry.js#L36) |
| `mkpm.telemetry.boiler` | `logRow.id` | `{ log_time, steam_flow_tph, boiler_efficiency_pct, fuel_feed_rate_tph }` | [telemetry.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/telemetry.js#L253) |
| `mkpm.telemetry.energy` | `{date}-{sec_id}`| `{ allocated_date, section_id, power_units_kwh, steam_units_mt }` | [telemetry.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/telemetry.js#L303) |
| `TOPICS.LAB` | `lab.id` | `{ test_time, test_type, sample_point, parameter_name, value }` | [telemetry.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/telemetry.js#L169) |
| `TOPICS.CORRELATION` | `{secId}-{stamp}` | `{ correlation_coefficient, parameter_a, parameter_b, sample_size }` | [telemetry.js](file:///c:/Project/MK%20Paper%20Mill/backend/src/routes/telemetry.js#L109) |

---

## 4. Code Pattern for Publishing Events

When introducing new event logs, always require/import `publish` (and `TOPICS` if applicable) and use a fail-safe pattern.

```javascript
const { publish, TOPICS } = require('../kafka');

// Fire and forget
publish(TOPICS.EVENTS_ALL, `item-${record.id}`, {
  event: 'module.item.action',
  id: record.id,
  userId: req.user.id,
  timestamp: new Date()
});
```
