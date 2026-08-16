# Telemetry & SCADA Module — Full Workflow & Rules

## Overview
Ingests and aggregates real-time plant telemetry from sensors and SCADA systems. Handles telemetry correlation (freeness-to-vacuum), hourly boiler thermodynamic efficiency logs, and daily energy allocations per section.

## Key Files
| File | Purpose |
|---|---|
| `backend/src/routes/telemetry.js` | Ingestion, trends, boiler, energy, correlation (335 lines) |
| `backend/src/routes/telemetry_expansion.js` | Supplementary telemetry endpoints |
| DB: `section_process_readings` | Core telemetry time-series table |
| DB: `quality_lab_tests` | Reads lab values for freeness correlation |
| DB: `boiler_performance_logs` | Logs boiler measurements + computed efficiency |
| DB: `section_energy_allocations` | Stores daily utility allocation metrics per section |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/telemetry` | Level 1+ | Ingests a new process sensor reading |
| GET | `/api/telemetry/section/:sectionId` | Level 1+ | Fetches recent readings for a section (last N hours) |
| GET | `/api/telemetry/:equipId` | Level 1+ | Fetches recent readings for a specific equipment |
| GET | `/api/telemetry/correlate` | Level 1+ | Calculates freeness-to-vacuum correlation (±15 min window) |
| POST | `/api/telemetry/lab` | Level 1+ | Logs a pulp/paper laboratory test result |
| GET | `/api/telemetry/lab/:reelId` | Level 1+ | Fetches laboratory test results for a specific reel |
| POST | `/api/telemetry/boiler` | Level 1+ | Logs hourly boiler performance and calculates efficiency |
| GET | `/api/telemetry/boiler/logs` | Level 1+ | Fetches recent boiler performance logs |
| POST | `/api/telemetry/energy` | Level 1+ | Records daily power, steam, and water allocations for a section |
| GET | `/api/telemetry/energy/allocations` | Level 1+ | Fetches daily energy allocations |

---

## 1. Process Ingestion & Telemetry Time-Series

Ingested parameters (e.g. speed, pressure, temperature, water intake) are saved to `section_process_readings`:
* **Sensor Identification:** Tag name (e.g. `PM1_WIRE_VAC_01`), parameter name (e.g. `Vacuum Pressure`), equipment ID, and section ID.
* **Metadata:** Records the reading time, shift ID, recorded by user ID, and source (`'SCADA'`, `'Manual'`, or `'PLC'`).
* **Broadcasting:** Ingested readings are immediately broadcasted to `mkpm.telemetry.readings` on Kafka for downstream correlation/monitoring.

---

## 2. Statistical Correlation (Freeness ↔ Vacuum)

To analyze the drainage properties of pulp on the wire table, the `/api/telemetry/correlate` endpoint joins laboratory tests with process telemetry:
* **Time Windows:** For each freeness value in `quality_lab_tests`, it queries `section_process_readings` for vacuum tag values (`tag_name ILIKE '%VAC%'`) within a **$\pm$ 15-minute window** around `test_time`.
* **Aggregations:** Computes the average, minimum, maximum, and count of vacuum readings.
* **Broadcasting:** Publishes computed correlation samples to `mkpm.analysis.correlation` on Kafka.

---

## 3. Boiler Thermodynamic Efficiency Logging

Logs boiler status and fuel consumption. It calculates thermodynamic thermal efficiency dynamically:

### Thermodynamic Formula:
$$Efficiency (\%) = \left( \frac{\text{Steam Flow (kg/h)} \times (\text{Steam Enthalpy} - \text{Feedwater Temp (°C)}))}{\text{Husk Consumption (kg/h)} \times \text{Fuel GCV}} \right) \times 100$$

* **Standard Constants:**
  * `Steam Enthalpy` = $660.0 \text{ kcal/kg}$
  * `Fuel GCV (Gross Calorific Value)` = $3200.0 \text{ kcal/kg}$
* **Calculated Range:** Clamped between $0\%$ and $100\%$.
* **Broadcasting:** Publishes results to `mkpm.telemetry.boiler`.

---

## 4. Section Energy Allocation

Allocates daily resource usage per plant section:
* **Unique Key:** Handled via `ON CONFLICT (allocated_date, section_id)` to allow clean daily updates.
* **Resource Quantities:** Tracks power consumed (kWh), steam (MT), and water (KL) per section.
* **Broadcasting:** Publishes events to `mkpm.telemetry.energy` for monitoring dashboards.

---

## 5. Rules & Constraints

1. **Ingestion Limits:** Sensor time-series telemetry uses high volume. Keep queries bounded using temporal indices on `reading_time`.
2. **Boiler Consistency:** Log time is unique on `boiler_performance_logs` table (`ON CONFLICT (log_time) DO UPDATE`).
3. **Data Types:** All parameters (pressure, flow, power) are validated as floats. Missing values default to 0.
4. **Failsafe Broadcast:** Kafka broker issues are caught silently. Telemetry ingestion must never fail because of a Kafka connection issue.
