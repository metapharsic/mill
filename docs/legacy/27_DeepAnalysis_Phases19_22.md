# Deep Analysis — Phases 19–22

Beyond basic production tracking. These phases wire up **cause-and-effect** data across
every mill section — machine telemetry, lab quality, machine events, and root-cause brain.

> Existing foundation: `section_process_readings`, `section_alarms`, `section_equipment`
> tables already exist (migration_plant_sections.sql). Phases below extend + activate them.

---

## 1. What Already Exists ✅

| Table | Purpose |
|-------|---------|
| `section_process_readings` | Time-series readings per tag/equipment (Manual/SCADA/Auto) |
| `section_alarms` | Alarm log with ack/resolve lifecycle |
| `section_equipment` | Equipment registry with capacity/motor/pressure specs |
| `section_kpi_snapshots` | Daily KPI rollup per section |
| `quality_tests` | Generic quality test log (schema.sql) |
| `quality_lab_tests` | **NEW** Lab results linked to reels (Ph20-A ✅) |
| `machine_events` | **NEW** Break/stop/e-stop event log (Ph21-A ✅) |

---

## 2. What Is Missing (Gaps)

### 🔴 Critical — Cannot do deep analysis without these

| # | Gap | Detail |
|---|-----|--------|
| 1 | **No quality-to-reel link** | `quality_tests` is generic; no `reel_id` FK → cannot trace paper break to freeness/CSF at forming. ✅ Fixed via `quality_lab_tests`. |
| 2 | **No machine events (break/stop)** | `section_alarms` is alarm-only; no structured event for paper break, web break, nip wrap, roll change. ✅ Fixed via `machine_events`. |
| 3 | **No telemetry for PM2 parameters** | Wire vacuum, jet/wire ratio, press nip load, steam hood temp — all absent from `section_process_readings` (0 rows). ✅ Routes built; needs operator adoption. |
| 4 | **No energy-per-section breakdown** | Power/steam in `utility_readings` is mill-total; cannot attribute to Wire vs Press vs Dryer. ⬜ Ph19-D pending. |

### 🟡 Should-Fix — Accuracy holes

| # | Gap | Detail |
|---|-----|--------|
| 5 | **Rewinder no slit yield** | No `trim_loss_mm`, `slit_count`, `core_waste` per rewinder job. ✅ Added to `quality_lab_tests`. |
| 6 | **Boiler efficiency not computed** | Feed-water, flue-gas, blow-down absent → can't calc thermal efficiency. ⬜ Ph19-D pending. |
| 7 | **ETP no COD/BOD tracking** | `utility_readings` has no effluent quality columns. ✅ Added to telemetry parameter templates. |
| 8 | **No reject root-cause** | `reject_pct` per reel exists but no reason code → no Pareto. ⬜ Ph22 pending. |

---

## 3. Kafka Event Streaming

All deep analysis data broadcasts events so downstream consumers (dashboards, alerts, ML) can react without polling.

### Kafka Topics

| Topic | Trigger | Payload |
|-------|---------|---------|
| `mkpm.dpr.events` | DPR saved | `{ dprId, date, reportedBy }` |
| `mkpm.events.critical` | Critical machine event logged | `{ eventId, eventType, sectionId, severity, eventTime }` |
| `mkpm.telemetry.readings` | Process reading ingested (Manual/SCADA) | `{ id, sectionId, tagName, parameterName, value, uom, readingTime }` |
| `mkpm.quality.lab` | Lab test result saved | `{ id, reelId, sectionId, freeness_csf, basis_weight_gsm, burst_factor, moisture_pct, dirt_count }` |
| `mkpm.events.all` | Any machine event (all severities) | `{ eventId, eventType, sectionId, severity, eventTime, description }` |
| `mkpm.analysis.correlation` | Ph20-C correlation result computed | `{ reelId, sectionId, freeness_csf, vacuumAvg, correlationWindow }` |

### Broker Config
```
KAFKA_BROKERS=localhost:9092   # default
KAFKA_ENABLED=true             # set false to disable (ERP still works)
```

All publishes are **fire-and-forget** — broker down = silent drop, request never blocked.

---

## 4. Phase Roadmap

### Ph19 — Process Telemetry (Me Measure Machine)

| Phase | Scope | Gaps | Status |
|-------|-------|------|--------|
| Ph19-A | Parameter templates per section (Wire, Press, Dryer, Boiler, ETP) | 3 | ✅ Done |
| Ph19-B | `POST /api/telemetry` + `GET /api/telemetry/:equipId` | 3 | ✅ Done |
| Ph19-C | `GET /api/telemetry/section/:sectionId` — trend fetch with shift window | 3 | ✅ Done |
| Ph19-D | Kafka broadcast on telemetry ingest (`mkpm.telemetry.readings`) | 3 | ✅ Done |

#### Key Parameters to Capture by Section

| Section | Parameters |
|---------|-----------|
| Wire | Vacuum levels (P1–P4), jet/wire ratio, wire speed, drainage rate, consistency |
| Press | Nip load (kN/m), felt moisture, press speed, press nip pressure |
| Pre Dryer | Steam pressure per group (G1–G6), felt tension, hood exhaust temp |
| Post Dryer | Steam pressure, cylinder temp, moisture before/after |
| Boiler | Steam pressure, feed-water temp, flue-gas temp, fuel consumption (husk), blow-down |
| ETP | Inlet flow, COD/BOD, pH, alum dose, polymer dose, effluent TSS |
| Centricleaner | Reject rate (%), pressure diff (inlet vs accept), consistency |
| Size Press | Starch concentration, pickup rate, nip load |
| Calender | Nip load, stack pressure, speed, moisture in/out |

---

### Ph20 — Quality Lab Data (Me Check Paper)

| Phase | Scope | Gaps | Status |
|-------|-------|------|--------|
| Ph20-A | `quality_lab_tests` table with `reel_id` FK | 1 | ✅ Done |
| Ph20-B | `POST /api/telemetry/lab` + `GET /api/telemetry/lab/:reelId` | 1 | ✅ Done |
| Ph20-C | Correlation endpoint: lab freeness ↔ wire vacuum (±15 min join) | 1 | ✅ Done |
| Ph20-D | Kafka broadcast on lab result (`mkpm.quality.lab`) | 1 | ✅ Done |
| Ph20-E | Rewinder slit yield tracking (`trim_loss_mm`, `slit_count`) | 5 | ✅ Done (in table) |

#### Key Lab Parameters

| Test | Unit | Purpose |
|------|------|---------|
| Freeness (CSF) | mL | Formation quality; correlates to wire drainage |
| Dirt count | mm²/m² | Cleanliness; correlates to centricleaner reject |
| Moisture (%) | % | Dryer efficiency |
| Basis weight (GSM) | g/m² | Primary grade parameter |
| Burst factor (BF) | — | Strength spec |
| Tensile (MD/CD) | N/m | Formation orientation |
| Cobb size | g/m² | Sizing quality; correlates to starch pickup |

---

### Ph21 — Machine Events (Me Find Break)

| Phase | Scope | Gaps | Status |
|-------|-------|------|--------|
| Ph21-A | `machine_events` table (event_type, severity, duration, root_cause_code) | 2 | ✅ Done |
| Ph21-B | `POST /api/events` — operator flags event at machine | 2 | ✅ Done |
| Ph21-C | `PATCH /api/events/:id/resolve` — resolve lifecycle | 2 | ✅ Done |
| Ph21-D | Kafka broadcast: Critical → `mkpm.events.critical`, All → `mkpm.events.all` | 2 | ✅ Done |

#### Event Types

| Event | Severity | Data Captured |
|-------|----------|---------------|
| Paper break | Critical | Location (wire/press/dryer), duration, operator, cause code |
| Web wrap | Critical | Section, roll affected, duration |
| Roll change (felt/wire) | Warning | Item tag, run hours, reason |
| Emergency stop | Critical | Equipment, triggered by, resume time |
| Chemical alarm | Warning | Tank ID, level, action taken |

---

### Ph22 — Deep Brain (Me Think Hard)

| Phase | Scope | Status |
|-------|-------|--------|
| Ph22-A | RCA linkage: event → nearest telemetry anomaly (±15 min window) | ⬜ Future |
| Ph22-B | Pareto report: top-5 break causes × section × shift | ⬜ Future |
| Ph22-C | Energy waste attribution: high-steam shifts vs paper quality vs breaks | ⬜ Future |
| Ph22-D | Predictive alert: if vacuum drops below threshold → notify operator | ⬜ Future |

---

## 5. Recommended Build Order

1. **Ph19-A/B/C/D** ✅ — Telemetry ingestion + Kafka.
2. **Ph20-A/B/C/D** ✅ — Quality lab + correlation + Kafka.
3. **Ph21-A/B/C/D** ✅ — Machine events + Kafka.
4. **Ph22** ⬜ — Analytics layer, after data accumulates (30+ days).

---

## 6. DB Tables Summary

| Table | New / Existing | Purpose |
|-------|---------------|---------|
| `section_process_readings` | Existing | Time-series telemetry |
| `section_alarms` | Existing | Alarm lifecycle |
| `section_equipment` | Existing | Equipment master |
| `quality_lab_tests` | NEW (Ph20-A) ✅ | Lab test per reel |
| `machine_events` | NEW (Ph21-A) ✅ | Break/stop event log |

---

## 7. API Endpoints Summary

| Method | Route | Purpose | Kafka Topic |
|--------|-------|---------|-------------|
| POST | `/api/telemetry` | Ingest process reading | `mkpm.telemetry.readings` |
| GET | `/api/telemetry/:equipId` | Trend for equipment | — |
| GET | `/api/telemetry/section/:sectionId` | All readings for section | — |
| POST | `/api/telemetry/lab` | Ingest lab result | `mkpm.quality.lab` |
| GET | `/api/telemetry/lab/:reelId` | Lab results for reel | — |
| GET | `/api/telemetry/correlate` | Freeness ↔ vacuum correlation | `mkpm.analysis.correlation` |
| POST | `/api/events` | Log machine event | `mkpm.events.critical` / `mkpm.events.all` |
| GET | `/api/events` | List events with filters | — |
| GET | `/api/events/section/:sectionId` | Events for section | — |
| PATCH | `/api/events/:id/resolve` | Resolve an event | — |
