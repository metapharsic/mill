# Daily Performance Statement (DPR) — Engine, Dept Flow & Validation
# Phase 17 — Real-Time Daily Production Report
# Stack: Node.js/Express + React 18 + PostgreSQL
# Last updated: 2026-07-06

---

## 0. Core Principle

> **No department writes the report. Every department creates transactions.
> The system ASSEMBLES the report from those transactions.**

Every number in the Daily Report traces to a validated transaction (timestamp + user id).
The DPR header carries the consolidated daily figures; the per-ton ratios
(`kg/ton`, `unit/ton`, `steam/ton`) are **computed server-side on read off PM/C production** — never stored, never typed.

Source report this models = the mill's daily WhatsApp PM/C statement (PM/C prod, GSM-wise sets,
running/down hrs, chemical kg/ton, furnish, power unit/ton, boiler steam & husk/ton).

---

## 1. Department → Artifact → Report Map

| # | Department | Artifact (transaction) | Table | Feeds report line | Status |
|---|-----------|------------------------|-------|-------------------|--------|
| 1 | **Production** | Reel slip | `reels` | PM/C prod, GSM-wise sets/MT | ✅ exists (MES) |
| 2 | **Production** | Shift / downtime | `shifts`, `downtime_entries` | Running/Down hrs, downtime reasons | ✅ exists |
| 3 | **Production** | Consolidated DPR | `daily_production_reports` (+3 children) | the whole statement header | ✅ **built Ph17** |
| 4 | **Quality** | Reel inspection | `reels.quality_status` | Finish production (approved MT) | ✅ exists |
| 5 | **Chemical / Store** | Chemical consumption | `chemical_consumption` | Chemical kg/ton | ✅ exists (ratio added Ph17) |
| 6 | **Raw Material / Pulp** | Furnish batch | `furnish_mix_log` | Local + OCC furnish, yield | ✅ **built Ph17** (was MISSING) |
| 7 | **Utility** | Power + boiler readings | `utility_readings` | Power unit/ton, steam/ton, husk/ton | ✅ exists (ratio added Ph17) |
| 8 | **Store** | Material issue | `stock_ledger` | traceability of chemical/furnish | ✅ exists |

### Masters added Ph17
| Master | Table | Purpose |
|--------|-------|---------|
| Downtime reason codes | `downtime_reason_codes` | Coded downtime (no free text). 10 seeded (MECH-VBOX-001 …). |
| Per-ton standards | `dpr_grade_standards` | Norms for variance (starch 28, power 230, steam 1.6, husk 0.28, yield 91). |

---

## 2. Updated Database Fields (DPS Ingestion Extension)

To support direct Excel uploading from the mill's consolidated Daily Performance Statement, the `daily_production_reports` table has been extended with the following fields:

| Field | Type | Description |
|---|---|---|
| `start_time` | `VARCHAR(20)` | Start time of the statement period |
| `end_time` | `VARCHAR(20)` | End time of the statement period |
| `gsm_raw` | `VARCHAR(100)` | Raw string representing run GSMs (e.g. `120/140/150`) |
| `bf_raw` | `VARCHAR(100)` | Raw string representing run BFs (e.g. `18/20`) |
| `draw_avg` | `NUMERIC(8,2)` | Average draw percentage |
| `machine_speed_avg` | `NUMERIC(8,2)` | Average machine operating speed (m/min) |
| `moisture_pct_avg` | `NUMERIC(5,2)` | Average moisture percentage |
| `prv_pressure_temp` | `VARCHAR(50)` | Steam PRV pressure and temperature parameters |
| `pulper_running_minutes` | `INTEGER` | Total pulper operating hours (converted to minutes) |
| `pulper_units` | `NUMERIC(12,2)` | Electrical energy units consumed by pulpers |
| `etp_inlet_ppm` | `NUMERIC(8,2)` | Effluent Treatment Plant inlet suspended solids / COD (PPM) |
| `etp_outlet_ppm` | `NUMERIC(8,2)` | Effluent Treatment Plant outlet suspended solids / COD (PPM) |
| `etp_inlet_flow` | `NUMERIC(12,2)` | ETP inlet flow rate |
| `etp_outlet_flow` | `NUMERIC(12,2)` | ETP outlet flow rate |
| `fresh_water_mt` | `NUMERIC(12,3)` | Fresh water consumption in Tons |
| `feed_water_mt` | `NUMERIC(12,3)` | Feed water consumption in Tons |
| `condensate_water_mt` | `NUMERIC(12,3)` | Steam condensate returned in Tons |

---

## 3. Direct Machine IoT Integration Roadmap (Phased Design)

Moving from manual Excel uploads to direct machine IoT ingestion is split into structured phases:

### Phase 1: Manual Excel Bulk Upload (OT/IT Layer 0)
* **Goal:** Allow supervisors to import daily logs via Excel templates.
* **Mechanism:** Spreadsheet uploaded to `/api/production/dpr/import`. Server parses, registers, and calculates ratios.
* **Outcome:** Establishes data integrity and a baseline.

### Phase 2: Hybrid Ingestion (OPC UA / SCADA Telemetry Bridge)
* **Goal:** Automate continuous key parameters directly from instruments.
* **Mechanism:** IoT Collectors (Node-RED/MQTT) read machine speeds, steam flows, and power meters directly.
* **Outcome:** Pushes automatic telemetry to `/api/telemetry` with `source='Auto'`. Reduces manual typing by 50%.

### Phase 3: Complete Autonomous Generation
* **Goal:** Zero human typing required.
* **Mechanism:** All inputs (chemical flows, ETP meters, weighing scale outputs) stream directly via OPC UA and Kafka.
* **Outcome:** The Daily Performance Statement is assembled entirely from real-time transaction data.

---

## 4. API Reference — `/api/production/dpr`

| Method | Endpoint | Guard | Action |
|--------|----------|-------|--------|
| POST | `/import` | L2+ | Parse uploaded DPS Excel file, insert/update report + breakup entries, and broadcast via Kafka |
| GET | `/daily-report?date=&machine_id=` | L1+ | Full report + computed ratios + variance |
| GET | `/daily-report/list?from=&to=` | L1+ | Header list |
| GET | `/daily-report/autofill?date=&machine_id=` | L1+ | Assemble from shop floor |
| POST | `/daily-report` | L1+ | Upsert header + children |
| PUT | `/daily-report/:id/approve` | L3+ | Sign off / Approve report |
