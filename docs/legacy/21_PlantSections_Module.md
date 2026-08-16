# Plant Sections Module — PaperMES Ph15

**Route group:** `/api/sections`  
**Frontend:** `PlantSection.jsx` (parameterized) + `AllSections.jsx`  
**DB migration:** `db/migrations/M11_plant_sections.sql`  
**Last updated:** 2026-06-29

---

## Architecture

```
Sidebar (Plant Sections group)
  └── 21 section nav items → PlantSection.jsx?code=PULP|WIRE|...
        ├── KPI Strip        ← GET /api/sections/:code/readings (last 1h avg)
        ├── Equipment Table  ← GET /api/sections/:code/equipment
        ├── Reading Log Form ← POST /api/sections/:code/readings
        ├── Alarm Panel      ← GET /api/sections/:code/alarms?status=active
        ├── Trends Chart     ← GET /api/sections/:code/readings?last=24h&tag=X
        └── SOP Accordion    ← GET /api/sections/:code/sops

AllSections.jsx (🌐)
  └── Polls /api/sections/all/kpi-snapshot every 60s
      └── 21 SectionCard components (icon + name + top 3 KPIs + alarm badge)
```

---

## DB Schema Summary

### 5 New Tables (M11 migration)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `plant_sections` | Master registry of 21 sections | section_code, name, icon, sort_order |
| `section_equipment` | Every machine/instrument per section | tag_name, equipment_type, motor_kw, is_critical |
| `section_process_readings` | Time-series tag values (manual + SCADA) | tag_name, value, uom, reading_time, source |
| `section_alarms` | Alarm/event log with ack/resolve lifecycle | alarm_type, triggered_at, maintenance_log_id |
| `section_sops` | Startup/Shutdown/Emergency procedures | sop_type, steps(JSONB), version |
| `section_kpi_snapshots` | Hourly KPI cache for All Sections aggregator | kpi_data(JSONB), snapshot_time |

---

## Section → Parameters Matrix

| Section | Critical Parameters | Common Alarms | KPI Targets |
|---------|--------------------|--------------|----|
| 🪵 Pulp Mill | Consistency %, Freeness °SR, Refiner SEC kWh/T, pH, Brightness ISO% | Screen plugging, refiner plate wear, foaming | Reject% <5, Brightness >80 ISO |
| 🌀 Centricleaner | Inlet pressure 2.5–3.0 bar, ΔP, Reject rate% | Nozzle wear, apex blockage, low ΔP | Dirt removal >95% |
| 🕸️ Wire | Headbox pressure, Jet/Wire ratio 0.98–1.02, Vacuum kPa, Retention% | Wire mark, CD basis weight variation, wire wear | Couch dryness >18% |
| 💨 Vacuum | Vacuum kPa per zone, Seal water temp, Motor current A | Cavitation, separator flooding, pump overheating | Sheet dryness per element |
| 🗜️ Press | Nip load kN/m, Post-press dryness%, Felt permeability | Felt plugging, sheet crushing, vibration | Post-press dryness >42% |
| 🏃 Unirun | Felt tension, Vacuum at transfer, Speed differential | Sheet flutter, web breaks, felt contamination | Break rate <1/shift |
| 🔥 Pre Dryer | Steam pressure bar (per group), Cylinder temp, Hood dewpoint | Condensate flooding, blow-through steam, fabric wear | Evaporation rate, steam/T |
| 📏 Size Press | Starch solids%, Viscosity cP, Pickup g/m², Nip load | Skipping, foam, sheet break, uneven pickup | Cobb value, IGT surface strength |
| 🍳 Size Kitchen | Cooking temp 130–145°C, Solids%, Viscosity cP | Under-cooked starch, microbial growth, foam | Starch consumption kg/T |
| ☀️ Post Dryer | Steam pressure, Final moisture%, CD profile σ | Over-drying, moisture streaks, CD variation | Final moisture 5–7% |
| 🛢️ Calender | Nip load kN/m, Roll temp, Entry moisture 3–6% | Blackening, barring, caliper variation | PPS roughness, gloss% |
| ⭕ Pope Reel | Reel hardness, Nip load, Turn-up success% | Reel burst, telescoping, turn-up failures | Turn-up efficiency >98% |
| 🔄 Rewinder | Web tension N/m, Slitter sharpness, Winding hardness | Dust, telescoping, soft rolls, slitter wear | Trim loss% <3 |
| 🧪 Starch Kitchen | Cooking temp, Solids%, Cationic charge meq/g | Retrogradation, lumps, microbial growth | Retention improvement% |
| 💧 Steam & Condensate | Steam pressure each group, Condensate return%, Trap performance | Trap failure, condensate flooding, water hammer | Specific steam T/T paper |
| 🍀 ETP | pH, BOD ppm, COD ppm, DO ppm, MLSS, TSS | Bulking sludge, low DO, shock loads | BOD removal >90%, CPCB norm |
| 🌋 Boiler | Steam pressure bar, Drum level%, O₂% flue gas, Feedwater quality | Tube leaks, slagging, DM contamination | Efficiency >82% |
| 🔬 Lab | Tests/day, Pass rate%, COA turnaround time | Test equipment failure, sample backlog | First-pass conformance >95% |
| 🏗️ Cranes | SWL, Lifts/shift, Availability%, Hours run | Wire rope wear, limit switch failure, brake slip | Availability >95% |
| 🌬️ Compressors | Discharge pressure 6–8 bar, Dew point °C, Loading% | High dew point, oil contamination, leaks | Specific power kW/Nm³/min |

---

## Sync Contract (standard schema for all sections)

```json
{
  "sectionId": 2,
  "sectionCode": "PULP",
  "name": "Pulp Mill",
  "icon": "🪵",
  "lastSync": "2026-06-29T08:30:00Z",
  "liveReadings": [
    { "tagName": "PULP-HC-001", "parameterName": "Consistency", "value": 3.5, "uom": "%", "readingTime": "..." }
  ],
  "kpis": {
    "consistency_pct": 3.5,
    "freeness_sr": 42,
    "refiner_sec_kwh": 85.2,
    "brightness_iso": 81.3,
    "reject_pct": 2.1
  },
  "alarms": [
    { "id": 12, "alarmType": "Warning", "description": "Screen DP high", "triggeredAt": "..." }
  ],
  "alarmCounts": { "critical": 0, "warning": 1, "info": 2 }
}
```

---

## Tag Naming Convention

```
{SECTION_CODE}-{EQUIPMENT_TYPE_ABBREV}-{SEQ}
Examples:
  PULP-HD-001   → Pulp Mill, High-Density Cleaner #1
  WIRE-VB-003   → Wire Section, Vacuum Box #3
  BOIL-FD-001   → Boiler, Forced Draft Fan #1
  ETP-AT-001    → ETP, Aeration Tank #1
  COMP-SC-002   → Compressors, Screw Compressor #2
```

---

## Alarm Lifecycle

```
Raised (Critical/Warning/Info)
  ↓
Acknowledged (by Supervisor+)
  ↓ [if Critical → auto-link maintenance_logs row]
Resolved + resolution_note
  ↓
Closed (can view in history, never deleted)
```

---

## Equipment Types (dropdown values)

Pump | Fan | Compressor | Screen | Cleaner | Refiner | Dryer Cylinder | Press Roll | Felt | 
Wire/Fabric | Vacuum Pump | Heat Exchanger | Tank/Chest | Agitator | Conveyor | Crane | 
Boiler | Clarifier | Aerator | Filter | Roll | Reel | Winder | Sensor | Valve | Other

---

## Build Sequence (Ph15)

```
Ph15-A: db/migrations/M11_plant_sections.sql
        → 5 tables + seed 21 plant_sections rows + tag naming seed data

Ph15-B: backend/src/routes/sections.js
        → 9 API endpoints + alarm→maintenance ACID link + KPI snapshot cron

Ph15-C: frontend/src/pages/PlantSection.jsx
        → Parameterized by sectionCode prop
        → Tabs: Overview | Equipment | Readings | Alarms | SOPs

Ph15-D: frontend/src/pages/AllSections.jsx
        → 60s poll aggregator, 21 SectionCard grid

Ph15-E: frontend/src/pages/Sidebar.jsx
        → Add "Plant Sections" group (21 nav items)
        → App.jsx routing: key.startsWith('sections-') → <PlantSection>

Ph15-F: KPI snapshot cron in server.js startup (hourly setInterval)
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `db/migrations/M11_plant_sections.sql` | CREATE (new) |
| `backend/src/routes/sections.js` | CREATE (new) |
| `backend/src/server.js` | MODIFY — mount sections route + add KPI cron |
| `frontend/src/pages/PlantSection.jsx` | CREATE (new) |
| `frontend/src/pages/AllSections.jsx` | CREATE (new) |
| `frontend/src/pages/Sidebar.jsx` | MODIFY — add Plant Sections NAV group |
| `frontend/src/App.jsx` | MODIFY — add sections routing logic |
